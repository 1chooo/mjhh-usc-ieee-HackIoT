import Link from "next/link";
import { RoomBoard } from "../components/room-board";

const factors = [
  "Library or classroom",
  "Open or closed",
  "How many people are in the room",
  "Hot and cold votes",
  "Outdoor temperature",
  "Humidity above 55%",
  "Body heat",
  "Floor area and wall loss",
];

export default function Home() {
  return (
    <div className="stack">
      <section className="hero">
        <p className="eyebrow">
          Temperature, votes, and the watt-hours between them
        </p>
        <h1>Decide when a library or a classroom should change the air.</h1>
        <p className="lede">
          Someone in the room can say it is too hot or too cold. The model uses
          that vote with the sensor, the schedule, and the weather, then
          compares the hour with a thermostat that never moves.
        </p>
        <div className="cta-row">
          <Link className="button" href="/rooms">
            Vote in a room
          </Link>
          <Link className="button secondary" href="/dashboard">
            Open the dashboard
          </Link>
          <Link className="button secondary" href="/simulator">
            Experiment with the factors
          </Link>
        </div>
      </section>
      <section className="stack">
        <h2>Factors this pass takes care of</h2>
        <ul className="chips">
          {factors.map((factor) => (
            <li key={factor}>{factor}</li>
          ))}
        </ul>
        <p className="note">
          Readings below are a simulated afternoon at 27°C, stored in this
          browser. They are not live sensors yet. Energy is the load to hold a
          setpoint for one hour, not a utility bill.
        </p>
      </section>
      <RoomBoard />
    </div>
  );
}
