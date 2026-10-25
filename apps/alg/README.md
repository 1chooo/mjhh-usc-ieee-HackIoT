# alg end-to-end test

Tests the whole loop: vote on the web page → the Pi reads the votes → it writes back to Supabase → the web page shows the result.

> Note: this writes to the live Supabase project `avcqkyfobsalzdzzgvqm`. There is no separate test database.

`TEST_INTERVAL` at the top of `main.py` picks the mode:

- `TEST_INTERVAL = 9` (a number): test mode. Each cycle opens voting for that many seconds, then runs right away, and the simulated time moves forward one hour per cycle. The model state is **not** saved to `R101.json`.
- `TEST_INTERVAL = None`: real mode. A cycle runs every hour at `RUN_MINUTE` (:30), and the next hour is preset at `PRESET_MINUTE` (:45).

Steps:

1. Start the web app:
   ```sh
   pnpm --filter web dev                       # http://localhost:3000/vote
   ```
2. Start the Pi loop:
   ```sh
   python3 apps/alg/main.py
   ```
3. When the terminal shows `vote now: N s left (hot x / cold y)`, vote hot or cold on `/vote`. The count in the countdown should go up live.
4. After the countdown you should see, in order (numbers are only examples):
   ```
   voting closed
   reading sensors...
   [time] 4 people, 24.0 C, hot 1 / cold 0 -> 24.5 C
   final temperature: 24.5 C
   saving to db...
   saved
   ```
5. Check:
   - Each vote counts in exactly one cycle: a vote cast **after** the countdown ends shows up in the next cycle, not this one.
   - With more votes than people it prints `N votes for M people, counting only ...` and scales the votes down to the head count, keeping the hot/cold ratio.
   - The web page's current people count, temperature, and target update to this cycle's values (the newest `record` row and the newest `setpoint` row).
6. `Ctrl+C` to stop.
