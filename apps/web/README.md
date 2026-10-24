# web

Next.js demo for library and classroom temperature.

- `/` explains the policy
- `/dashboard` is the admin view for every room, including the hot or cold vote
- `/rooms` and `/rooms/[id]` open that same dashboard
- `/simulator` edits the same factors the model uses

```sh
pnpm --filter web dev
```

The dev server listens on [http://localhost:3000](http://localhost:3000). Votes stay in this browser.
