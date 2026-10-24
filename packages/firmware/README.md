# firmware

C++ / PlatformIO firmware for ESP32 and Arduino boards.

```sh
pio run -d packages/firmware
pio device monitor -d packages/firmware
```

The sketch prints a boot line on serial at 115200. The gateway reads that port. MQTT payload shapes live in `packages/shared-types`.
