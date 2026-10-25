import Link from "next/link";
import { AlgorithmStory } from "../components/algorithm-story";
import { LandingSimulator } from "../components/landing-simulator";
import styles from "./page.module.css";

const mechanism = [
  {
    title: "Count the people.",
    body: "A camera estimates headcount on a Raspberry Pi. A DHT11 records room temperature.",
  },
  {
    title: "Learn from comfort.",
    body: "Hot and cold votes refine the headcount-based target. The model remembers preferences for recurring groups.",
  },
  {
    title: "Show the decision.",
    body: "The Pi publishes readings and recommended setpoints to Supabase. The dashboard follows each cycle.",
  },
];

export default function Home() {
  return (
    <div className="home">
      <section className={`hero ${styles.hero}`}>
        <h1>
          <span>Comfort for people.</span>
          <span>
            Less energy <em>wasted.</em>
          </span>
        </h1>
        <p className="lede">
          Cooling should follow the people in the room. MJHH combines
          camera-based headcounts and comfort feedback to recommend AC targets
          and explore the potential savings in energy, money, and carbon.
        </p>
        <div className="cta-row">
          <a className="button" href="#demo">
            Try the comparison
            <span className="arrow" aria-hidden="true">
              →
            </span>
          </a>
          <a className="button secondary" href="#mechanism">
            How it works
          </a>
        </div>
      </section>

      <section className={`section ${styles.mechanism}`} id="mechanism">
        <div className={styles.storyIntro}>
          <h2>
            Rooms change.
            <br />
            The thermostat should, too.
          </h2>
          <p className="lede">
            A headcount shows how busy a room is. It cannot tell us whether
            people feel too cold. MJHH learns from both headcounts and comfort
            votes, so recurring groups can get a more suitable target.
          </p>
        </div>
        <ol className={styles.steps}>
          {mechanism.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
        <div className={styles.prototype}>
          <p>
            The prototype recommends setpoints. Physical AC control and measured
            energy savings are the next validation steps.
          </p>
          <div className={styles.liveLinks}>
            <Link className="text-link" href="/vote">
              Try a comfort vote ↗
            </Link>
            <Link className="text-link" href="/dashboard">
              Follow the room ↗
            </Link>
          </div>
        </div>
      </section>

      <LandingSimulator />

      <AlgorithmStory />
    </div>
  );
}
