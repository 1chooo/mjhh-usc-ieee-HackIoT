# MJHH judging guide

Assessment against the rubric in IMG_7516.HEIC. The weights total 100 points. These are readiness findings from the repository, not predicted judge scores or confirmation that hardware has run successfully.

| Criterion                               | Weight | What we can show                                                                                                                                   | What still needs proof                                                                                                                                                   |
| --------------------------------------- | -----: | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sustainability Impact                   |     25 | Fixed versus adaptive energy comparison, electricity cost and CO₂e estimates, and scaling from a room to a campus.                                 | Metered electricity savings under comparable conditions, with comfort tracked alongside energy use. Long spans and repeated rooms are illustrations.                     |
| Technical Execution and IoT Integration |     25 | Pi code for camera headcounts, DHT11 temperature logging, comfort votes, learned setpoints and Supabase records; browser views read those records. | An observed sensor → model → database → dashboard cycle on the assembled hardware. `set_ac` currently returns the target; it does not actuate an AC.                     |
| Functionality and Demo                  |     20 | Interactive presets, votes, time and scale controls, a live vote page and a room dashboard.                                                        | Rehearse one complete vote cycle with the Pi and verify new timestamps and a new setpoint. A simulated room comparison alone does not demonstrate the physical IoT path. |
| Creativity and Originality              |     15 | The combination of headcount, subjective comfort feedback and remembered preferences for recurring groups.                                         | Explain this specific design choice and show the learning behavior. Do not claim that smart thermostats or occupancy control are new inventions.                         |
| Presentation and Communication          |     15 | A problem → mechanism → comparison → scale story, with links to voting and the dashboard.                                                          | A short hands-on walkthrough that clearly distinguishes the live prototype, energy illustration and next hardware step.                                                  |

## The story to tell

“Have you ever sat in a nearly empty classroom that was still too cold? A fixed temperature can miss both who is there and how they feel.

MJHH brings those signals together. A camera estimates headcount on a Raspberry Pi. People vote hot or cold. Our learning model uses those votes to refine a headcount-based AC target and remember the preferences of recurring groups. A DHT11 logs the room temperature, and the dashboard shows the readings and recommended setpoint.

Here is the energy question: when can a different target reduce unnecessary conditioning? This comparison lets us explore that against a fixed target. It shows estimated electricity, cost and CO₂e, including cases where comfort needs more energy.

One room is a start. Repeating a useful decision across more rooms, homes and buildings could grow the benefit. These are illustrative totals; the next proof is a metered pilot and a physical AC connection.”

## Walk through the build

1. Start at the landing page. Explain the problem in one sentence, then point to the camera, Pi and DHT11 on the table.
2. Open `/vote` and `/dashboard` side by side. Cast one vote during the Pi’s voting window. Show the count, then a new reading timestamp and recommended setpoint after that cycle. Use the configured test interval to avoid waiting an hour.
3. On the landing comparison, choose **Overcooled lecture**, then **Empty classroom**. Explain why raising a cooling target or relaxing an empty-room target can reduce the modeled load. Choose **Warm reading room** to show the comfort tradeoff honestly.
4. Change the room count from one room to a home, neighborhood and campus. Say: “We repeat the current room conditions here; this is potential scale, not a forecast for these buildings.” Longer time spans also repeat those conditions.
5. Close with the next proof: connect a physical output, then compare metered electricity and comfort under similar schedules, weather and occupancy. Include the sensing/computing equipment’s energy use in the evaluation.

The pictured instructions describe an informal, science-fair-style walkthrough. Use the running prototype and simulator as the presentation; a slide deck is not required.

## Keep the technical claims precise

- The **Pi learning model** in `apps/alg/acmodel.py` learns from headcount, comfort votes and recurring-group patterns. In `apps/alg/main.py`, DHT11 temperature is logged; it is not an input to that learning model.
- The **landing energy illustration** uses `apps/web/lib/thermal.ts`, a separate rule-based thermal policy. Its savings do not measure the Pi model’s actual energy performance.
- `apps/alg/main.py` writes `record` and `setpoint`. It currently does not write `saving`, even though the backend and dashboard support that table. Do not promise that the Pi run will produce a new dollar-savings record.
- `apps/alg/main.py::set_ac` is the unfinished actuator boundary. The separate device gateway validates and records command topics; its current code does not open a hardware port or publish MQTT messages. The ESP32 sketch only prints a serial boot line.
- The Python and web AC models use 16–30°C limits and 0.5°C steps. Describe these as configured bounds, not proof of comfort, energy savings or equipment compatibility.
- Do not describe modeled kWh, illustrative CO₂e factors, scaled totals or the simulated comfort improvement in the root README as measured results from an occupied building.

## Evidence to bring to the table

Bring a running sensor cycle with a visible headcount, temperature, vote count, target and fresh dashboard timestamp. If the hardware path is unavailable, show the simulator and call it a simulation. For stronger sustainability evidence, retain paired fixed-target and adaptive runs with electricity readings, timestamps, occupancy, weather and comfort feedback. Report both savings and increases.

The project addresses all five rubric categories. The clearest remaining gap is demonstrated physical integration and measured impact; stronger wording helps judges understand the build, but does not replace that evidence.
