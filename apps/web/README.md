# web

Next.js demo for library and classroom temperature.

- `/` explains the policy
- `/rooms` and `/rooms/[id]` are the in-room hot or cold vote
- `/dashboard` compares each room with a fixed setpoint
- `/simulator` edits the same factors the model uses

```sh
pnpm --filter web dev
```

The dev server listens on [http://localhost:3000](http://localhost:3000). Votes stay in this browser.
