# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

MJHH monorepo (USC IEEE hackathon): a Next.js dashboard, a Node.js hardware gateway, a Supabase backend, ESP32 firmware, shared MQTT message specs, and an optional YOLO training workspace. Most of it is still scaffold: the pieces are laid out, but they don't talk to each other yet.

## Commands

Requires Node ≥24 and pnpm 11 (`packageManager` pins `pnpm@11.25.0`).

```sh
pnpm install
pnpm dev            # all apps via turbo: web on :3000, device-gateway on :4000
pnpm build          # only `web` has a build step
pnpm lint
pnpm check-types    # web runs `next typegen` before tsc
pnpm format         # prettier on ts/tsx/md only

# one package (names: web, device-gateway, @repo/shared-types, @repo/ui)
pnpm --filter device-gateway dev
pnpm --filter @repo/shared-types check-types
```

No package has tests or a test runner. Lint and `check-types` are the only automated checks. The one exception is `apps/backend/tests/test_api.py` (stdlib Python), which tests the live Supabase REST API. It needs `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` in the environment or `apps/backend/.env`. It writes rows to the live tables and deletes them by id afterwards, so it leaves existing data alone.

Outside pnpm/turbo (these have no `package.json`):

```sh
pio run -d packages/firmware              # build ESP32 firmware
pio device monitor -d packages/firmware   # serial monitor, 115200 baud

cd packages/yolo && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python train.py --data /path/to/data.yaml [--model yolo11n.pt --epochs 50 --imgsz 640]

cd apps/backend && supabase migration new <name>   # then: supabase link --project-ref avcqkyfobsalzdzzgvqm && supabase db push
python3 apps/backend/scripts/seed.py [--reset]     # 2 h of sample Pi cycles (needs SUPABASE_SECRET_KEY)
```

## Architecture

**Internal packages ship source, not builds.** `@repo/shared-types` exports `./src/index.ts` and `@repo/ui` exports `./src/*.tsx` directly. Consumers compile them: Next.js for `web`, Node's type stripping for `device-gateway`. Don't add a build or `dist` step to these packages.

**device-gateway runs TypeScript with no compile step** (`node --experimental-strip-types`). Use only erasable TS syntax: no `enum`, `namespace`, or constructor parameter properties, and use `import type` for type-only imports. `tsc` runs only for `check-types` (`noEmit`). The gateway is plain `node:http` with no framework and no runtime deps.

**The message contract is duplicated in four places that must change together:**

1. `packages/shared-types/schemas/device-command.json` / `device-telemetry.json`: the wire format and source of truth.
2. `packages/shared-types/src/index.ts`: TS types (`DeviceCommand`, `DeviceTelemetry`, `commandActions`) and the topic helpers `commandTopic()` / `telemetryTopic()`.
3. `packages/shared-types/schemas/topics.json`: topic patterns with a `{deviceId}` placeholder. The gateway reads this file at runtime via `import.meta.resolve`, not through the TS helpers.
4. `parseCommand()` in `apps/device-gateway/src/index.ts`: hand-written validation that mirrors `device-command.json` (there's no JSON Schema validator).

Topics are `mjhh/devices/{deviceId}/command` and `mjhh/devices/{deviceId}/telemetry`.

**Current command flow:** `POST /commands` → `parseCommand` → resolve the topic from `topics.json` → log it → `202 { accepted, topic, ports }`. There's no MQTT client or broker yet, and no serial port is opened. `HARDWARE_PORTS` (comma-separated, e.g. `/dev/cu.usbserial-0001`) is only parsed and echoed back. `GET /health` returns the configured ports. The intended design is that the gateway owns the local hardware ports, falling back to a Python adapter when a device library is Python-only.

**backend** (`apps/backend`) is a Supabase project with no server code, outside pnpm and turbo. It serves a single room, so no table has a room or location column. The Raspberry Pi (`apps/alg/main.py`) writes one snapshot per cycle: `record` (people count and temperature; the newest row is the current reading), `setpoint` (the AC model's target) and `saving` (dollars saved that cycle). The browser only inserts into `vote`, an inbox with no stored counts: a cycle's votes are the ones between its `record` and the previous one. The schema is in `supabase/migrations/` and is applied to the hosted project `avcqkyfobsalzdzzgvqm`. `DBSCHEMA.md` explains the tables, and `API.md` lists the auto-generated REST endpoints and which key (publishable or secret) can call each one. This project's default privileges grant `anon` and `authenticated` everything on new `public` tables, so every migration must `revoke all` before granting.

**web** is still the create-turbo starter page. It doesn't yet depend on `@repo/shared-types` or call the gateway; add `"@repo/shared-types": "workspace:*"` when wiring it up.

**firmware** has one PlatformIO env, `esp32dev` (Arduino framework). Add another `[env:...]` for Arduino boards. Firmware talks over serial at 115200, which is the port the gateway is meant to read.

**yolo** is standalone Python, outside pnpm and turbo. Datasets, `runs/`, and `*.pt`/`*.onnx`/`*.engine` are gitignored. Detections are meant to flow back as telemetry through the gateway, in the `device-telemetry.json` shape.

## Conventions and gotchas

- **Lint is zero-warning.** `@repo/eslint-config` includes `eslint-plugin-only-warn`, which turns every error into a warning, and every package lints with `--max-warnings 0`, so any warning fails. The base config has no Node globals: the gateway declares `Buffer`, `URL`, `console`, and `process` by hand in `apps/device-gateway/eslint.config.js`, so add new Node globals there. The base config also enables `turbo/no-undeclared-env-vars`.
- The TS base config is `strict` with `noUncheckedIndexedAccess`. The repo uses TypeScript 7.
- **Turborepo:** see `AGENTS.md`. Read the installed `turbo` package's bundled `docs/` before changing `turbo.json` or turbo commands, because behavior may differ from what you expect.
- **Commits:** conventional commits scoped by package (`feat(shared-types): …`, `feat(gateway): …`, `feat(backend): …`, `feat(firmware): …`, `feat(yolo): …`). The repo-local `1chooo-commits` skill (`.agents/skills/`, symlinked into `.claude/skills/`) defines the style.
