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

The web demo has a landing page, a public room board, a public impact page for the shared demo hour, an admin dashboard, and a simulator. Readings and votes stay in the browser.

## Firmware and training

```sh
pio run -d packages/firmware
```

YOLO setup, dataset layout, and the train command are in [packages/yolo/README.md](packages/yolo/README.md). Checkpoints and datasets stay out of git.

AC setpoint model
Turns a room's people count and hot/cold votes into a target AC temperature (16–30 °C, in 0.5 °C steps). Two single files with no dependencies give the same answers: acmodel.py (Python) and acmodel.js (JavaScript).

from acmodel import SimpleModel

model = SimpleModel("lab-101", state_file="state/lab-101.json")   # one per room
target = model.update(ppl, hot, cold)                             # once an hour, after the vote
How it decides. target = curve(ppl) + offset(group). The curve is how cold the AC must be for that many people. It starts at 26 °C for one person down to 18 °C for 300 and is re-fitted after every vote. A group is 15 or more people who start on the same weekday and hour, with a similar headcount, as in an earlier week; each group's offset is learned from its own votes and kept across weeks. The model aims for as many hot votes as cold ones, moves only in the direction a vote points, and changes the AC only when the new value is at least 0.5 °C away. next_hour(ppl) can set the room for a returning group before it arrives.

Results (simulated). Over 8 weeks with classes that each preferred somewhere between 18 and 28 °C, the gap between the room and what the class wanted fell from 2.5 °C (people count only) to 1.0 °C.
