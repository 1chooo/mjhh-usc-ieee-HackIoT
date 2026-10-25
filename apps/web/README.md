# web

Next.js demo for library and classroom temperature.

- `/` introduces the control model and includes a reusable interactive comparison
- `/dashboard` is the admin view for every room, including the hot or cold vote
- `/rooms` and `/rooms/[id]` open that same dashboard
- `/simulator` edits the same factors the model uses

```sh
pnpm --filter web dev
```

The dev server listens on [http://localhost:3000](http://localhost:3000). Votes stay in this browser.

## Landing comparison

`LandingSimulator` uses the same `evaluate` function and room presets as the full simulator. Its traditional baseline holds the room-type midpoint (22.5°C for classrooms, 23.5°C for libraries). The adaptive policy responds to occupancy, schedule, and comfort votes; temperature and humidity also inform its current heat/cool/hold call. This is a rule-based demo with illustrative readings, not trained-model inference or live HVAC control.

The connected `ScaleStory` extends the selected room's result to 1–1,000 similar rooms for the same modeled hour. Room, home, neighborhood, and campus options illustrate scale; their room counts are editable examples, not typical building sizes. All rooms repeat the current scenario and assumptions, so the totals are a linear illustration rather than a building forecast. Extra energy use scales up too.

The existing thermal model estimates steady-state heating/cooling load from the building envelope and body heat. `compareEnergyImpact` converts that thermal kWh to electrical kWh by dividing by the coefficient of performance (COP), then multiplies by the electricity rate and grid carbon factor. Both methods use the same room, conditions, duration, and equipment assumptions. Negative savings remain visible when comfort uses more energy.

Defaults are illustrative: COP 3, $0.25/kWh, and 0.4 kg CO₂e/kWh. Visitors can change them in the demo. Cost excludes fixed and demand charges. The estimate excludes fan power, humidity removal, equipment cycling, and recovery after a setback. A current “hold” call can coexist with a nonzero steady-state load; the comparison does not integrate the current call over time. CO₂e represents an electricity footprint estimate, not measured or verified marginal emissions avoided.

Method references: [DOE COP definition](https://www.energy.gov/cmei/femp/incorporate-minimum-efficiency-requirements-heating-and-cooling-products-federal) and [EPA guidance on electricity emissions factors](https://www.epa.gov/egrid/frequent-questions-about-egrid).

Run the conversion and edge-case checks with:

```sh
node --test apps/web/tests/energy-impact.test.mjs
```
