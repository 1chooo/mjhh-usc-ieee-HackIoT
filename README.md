# MJHH—USC IEEE's HackIoT

Monorepo for device control: a Next.js dashboard, a local hardware gateway, ESP32/Arduino firmware, shared MQTT message specs, and an optional YOLO training workspace.

## Layout

```
├── apps/
│   ├── web/              # Next.js app for room votes, the dashboard, and the simulator
│   └── device-gateway/   # Node.js server that talks to local hardware ports
├── packages/
│   ├── firmware/         # C++/PlatformIO code for Arduino/ESP32
│   ├── shared-types/     # Shared message specs (JSON schemas over MQTT)
│   ├── yolo/             # Optional YOLO model training (Python)
│   ├── ui/               # Shared React components
│   ├── eslint-config/
│   └── typescript-config/
├── package.json
└── turbo.json
```

`device-gateway` is Node.js so it can import `@repo/shared-types`. A Python adapter can own a port when a device library is Python-only. YOLO training stays in `packages/yolo` and is not a JavaScript package.

## Prerequisites

- Node.js 24 or newer
- pnpm 11
- PlatformIO, when building `packages/firmware`
- Python 3.11 or newer, when training in `packages/yolo`

## Develop

```sh
pnpm install
pnpm dev
```

Or one app at a time:

```sh
pnpm --filter web dev
pnpm --filter device-gateway dev
```

`web` listens on port 3000. `device-gateway` listens on port 4000.

The web demo has a landing page, an in-room hot/cold vote (`/rooms`), a dashboard, and a simulator for the temperature factors. Readings and votes stay in the browser.

## Firmware and training

```sh
pio run -d packages/firmware
```

YOLO setup, dataset layout, and the train command are in [packages/yolo/README.md](packages/yolo/README.md). Checkpoints and datasets stay out of git.
