'''
Every hour at RUN_MINUTE: count people -> read temperature -> read votes -> model.update() -> set the AC.
Optionally at PRESET_MINUTE: model.next_hour() presets the AC for the class coming next.
'''
import time
from datetime import datetime, timedelta

from acmodel import SimpleModel

ROOM_ID = "R101"
STATE_FILE = f"{ROOM_ID}.json"   # the model remembers what it learned across restarts
RUN_MINUTE = 30                  # main task: after the vote closes
PRESET_MINUTE = 45               # ~15 min before the next hour; set to None to disable
CAMERA_SOURCE = 0                # camera index, video file or RTSP URL
TEST_INTERVAL = 10               # seconds between cycles for testing; None = real hourly schedule

_counter = None


# ---------------------------------------------------------------------- inputs
def count_people() -> int:
    """Camera -> current head count (YOLO model is loaded once, camera only opened while counting)."""
    global _counter
    if _counter is None:
        from camera_number_detection import PeopleCounter
        _counter = PeopleCounter(CAMERA_SOURCE)
    return _counter.count()


def read_temperature() -> float:
    """Room temperature in C (not a model input, logged only). TODO: real sensor."""
    return 24.0


def read_votes() -> tuple[int, int]:
    """Vote result for this hour -> (hot, cold). TODO: real vote source."""
    return 20, 30


def set_ac(target: float):
    """Send the target temperature to the AC."""
    return target
    # print(f"  -> AC set to {target} C")


# ---------------------------------------------------------------------- the periodic tasks
def run_cycle(model: SimpleModel, timestamp: str | None = None):
    n = count_people()
    temp = read_temperature()
    hot, cold = read_votes()
    hot, cold = min(hot, n), min(cold, max(n - min(hot, n), 0))   # model rejects hot + cold > n_people
    target = model.update(n, hot, cold, timestamp)
    print(f"[{datetime.now():%Y-%m-%d %H:%M}] {n} people, {temp:.1f} C, hot {hot} / cold {cold} -> {target} C")
    set_ac(target)


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
'''
room_id
'''