# shared-types

MQTT message specs shared by `web` and `device-gateway`.

| File                            | Topic                               |
| ------------------------------- | ----------------------------------- |
| `schemas/device-command.json`   | `mjhh/devices/{deviceId}/command`   |
| `schemas/device-telemetry.json` | `mjhh/devices/{deviceId}/telemetry` |

`src/index.ts` exports the same topic helpers and TypeScript types. The JSON schemas are the wire format.
