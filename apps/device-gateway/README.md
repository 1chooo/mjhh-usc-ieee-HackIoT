# device-gateway

Node.js server that accepts device commands and is the place that opens local hardware ports.

`web` and this process share MQTT payload shapes from `@repo/shared-types`. This scaffold checks those shapes and records the topic. Opening a serial port, or calling a Python adapter for a device library that is Python-only, comes when a board is attached.

```sh
pnpm --filter device-gateway dev
```

Listens on port `4000`. Set `HARDWARE_PORTS` to a comma-separated list such as `/dev/cu.usbserial-0001`.

- `GET /health`
- `POST /commands` with a `DeviceCommand` body
