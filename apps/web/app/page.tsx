import Link from "next/link";
import { spaces } from "../lib/campus";

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
    <div className="home">
      <section className="hero">
        <h1>
          <span>Decide when</span>
          <span>a room should</span>
          <span>
            <em>change</em> the air.
          </span>
        </h1>
        <div className="cta-row">
          <Link className="button" href="/dashboard">
            Dashboard
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link className="button secondary" href="/simulator">
            Simulator
          </Link>
        </div>
      </section>

      <section className="section">
        <h2>What the hour considers</h2>
        <ul className="feature-rows">
          {factors.map((factor) => (
            <li key={factor}>{factor}</li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2>Rooms</h2>
        <ul className="room-index">
          {spaces.map((space) => (
            <li key={space.id}>
              <Link href={`/dashboard?room=${space.id}`}>
                <strong>{space.name}</strong>
                <span className="meta">{space.building}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
