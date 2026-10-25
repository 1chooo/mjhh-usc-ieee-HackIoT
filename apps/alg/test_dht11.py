import time

import board
import adafruit_dht

# GPIO4 = physical pin 7.
sensor = adafruit_dht.DHT11(board.D4, use_pulseio=False)

# The DHT11 can only measure about once every 2 s; faster calls return the cached value.
READ_INTERVAL = 2.1
REPORT_INTERVAL = 3  # Print an average every 3 s.

temperatures = []
humidities = []
last_temperature = None
last_humidity = None

try:
    time.sleep(2)  # Allow the sensor to settle.

    next_read = time.monotonic()
    next_report = time.monotonic() + REPORT_INTERVAL

    while True:
        now = time.monotonic()

        if now >= next_read:
            next_read = now + READ_INTERVAL
            try:
                temperature = sensor.temperature
                humidity = sensor.humidity
                if temperature is not None and humidity is not None:
                    temperatures.append(temperature)
                    humidities.append(humidity)
            except RuntimeError:
                pass  # Failed read; skip it so it doesn't affect the average.

        if now >= next_report:
            next_report += REPORT_INTERVAL
            if temperatures:
                last_temperature = sum(temperatures) / len(temperatures)
                last_humidity = sum(humidities) / len(humidities)
                note = f"average of {len(temperatures)} readings"
            else:
                note = "no good reading this window, showing last value"

            if last_temperature is not None:
                print(
                    f"Temperature: {last_temperature:.1f} °C | "
                    f"Relative humidity: {last_humidity:.1f}% ({note})",
                    flush=True,
                )

            temperatures.clear()
            humidities.clear()

        time.sleep(0.05)

except KeyboardInterrupt:
    print("\nStopped.")

finally:
    sensor.exit()
