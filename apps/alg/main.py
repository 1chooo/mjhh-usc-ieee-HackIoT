'''
Every hour at RUN_MINUTE: count people -> read temperature -> read votes -> model.update() -> set the AC.
Optionally at PRESET_MINUTE: model.next_hour() presets the AC for the class coming next.
'''
import os
import time
from datetime import datetime, timedelta

from acmodel import SimpleModel

HERE = os.path.dirname(os.path.abspath(__file__))   # so it works no matter which folder you start it from

ROOM_ID = "R101"
STATE_FILE = os.path.join(HERE, f"{ROOM_ID}.json")   # the model remembers what it learned across restarts
RUN_MINUTE = 30                  # main task: after the vote closes
PRESET_MINUTE = 45               # ~15 min before the next hour; set to None to disable
CAMERA_SOURCE = 0                # camera index, video file or RTSP URL
MODEL_PATH = os.path.join(HERE, "yolo26n.onnx")   # see camera_number_detection.py for how to export it
CONF = 0.4                       # detection confidence: lower = fewer missed people, more false hits
DHT_PIN = "D4"                   # DHT11 data pin: GPIO4 = physical pin 7
DHT_READINGS = 3                 # average this many good readings (the DHT11 needs ~2 s between reads)
TEST_INTERVAL = 9               # seconds between cycles for testing; None = real hourly schedule

_counter = None
_dht = None


# ---------------------------------------------------------------------- inputs
def count_people() -> int:
    """Camera -> current head count (ONNX model is loaded once, camera only opened while counting).
    Takes a few frames and returns the median, so one bad frame doesn't skew it."""
    global _counter
    if _counter is None:
        from camera_number_detection import PeopleCounter
        _counter = PeopleCounter(CAMERA_SOURCE, model=MODEL_PATH, conf=CONF)
    return _counter.count()


def read_temperature() -> float | None:
    """DHT11 -> room temperature in C (not a model input, logged only). None if every read failed."""
    global _dht
    if _dht is None:
        import adafruit_dht
        import board
        _dht = adafruit_dht.DHT11(getattr(board, DHT_PIN), use_pulseio=False)
        time.sleep(2)                    # let the sensor settle
    readings = []
    for _ in range(DHT_READINGS * 3):    # DHT11 reads fail often; allow some retries
        try:
            t = _dht.temperature
            if t is not None:
                readings.append(t)
        except RuntimeError:
            pass                         # failed read, just try again
        if len(readings) >= DHT_READINGS:
            break
        time.sleep(2.1)                  # faster calls only return the cached value
    return sum(readings) / len(readings) if readings else None


def read_votes() -> tuple[int, int]:
    """Vote result for this hour -> (hot, cold). TODO: real vote source."""
    return 2, 0


def set_ac(target: float):
    """Send the target temperature to the AC."""
    return target
    # print(f"  -> AC set to {target} C")


# ---------------------------------------------------------------------- the periodic tasks
def run_cycle(model: SimpleModel, timestamp: str | None = None):
    n = count_people()
    try:
        temp = read_temperature()
    except Exception as e:               # temperature is only logged, so a sensor problem must not stop the AC update
        print(f"  read_temperature failed: {e!r}")
        temp = None
    hot, cold = read_votes()
    # n = 60 if n == 1 else 70
    hot, cold = min(hot, n), min(cold, max(n - min(hot, n), 0))   # model rejects hot + cold > n_people
    
    target = model.update(n, hot, cold, timestamp)
    print(f"[{datetime.now():%Y-%m-%d %H:%M}] {n} people, {'n/a' if temp is None else f'{temp:.1f}'} C, hot {hot} / cold {cold} -> {target} C")
    print(set_ac(target))
    # return data to the database {人數, current temperature}



def run_preset(model: SimpleModel):
    n = count_people()
    target = model.next_hour(n)
    print(f"[{datetime.now():%Y-%m-%d %H:%M}] preset for next hour ({n} people) -> {target}")
    if target is not None:
        set_ac(target)



def next_run(now: datetime, minute: int) -> datetime:
    t = now.replace(minute=minute, second=0, microsecond=0)
    return t if t > now else t + timedelta(hours=1)


def test_loop():
    """Every TEST_INTERVAL seconds, as if one hour had passed (the model learns per hour, so a real
    timestamp would pile every 10 s reading into the same hour). Nothing is saved to STATE_FILE."""
    model = SimpleModel(ROOM_ID)
    fake = datetime.now().replace(minute=RUN_MINUTE, second=0, microsecond=0)
    while True:
        try:
            print(f"(simulated time {fake:%a %H:%M})")
            run_cycle(model, fake.isoformat())
        except Exception as e:
            print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] run_cycle failed: {e!r}")
        fake += timedelta(hours=1)
        time.sleep(TEST_INTERVAL)


def main():
    if TEST_INTERVAL:
        return test_loop()
    model = SimpleModel(ROOM_ID, state_file=STATE_FILE)
    jobs = [(RUN_MINUTE, run_cycle)] + ([(PRESET_MINUTE, run_preset)] if PRESET_MINUTE is not None else [])
    while True:
        now = datetime.now()
        when, job = min(((next_run(now, m), f) for m, f in jobs), key=lambda x: x[0])
        time.sleep(max((when - datetime.now()).total_seconds(), 0))
        try:
            job(model)
        except Exception as e:      # one bad reading must not kill the loop
            print(f"[{datetime.now():%Y-%m-%d %H:%M}] {job.__name__} failed: {e!r}")



if __name__ == "__main__":
    main()
