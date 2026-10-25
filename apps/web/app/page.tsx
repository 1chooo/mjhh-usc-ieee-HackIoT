import { LandingSimulator } from "../components/landing-simulator";
import styles from "./page.module.css";

const mechanism = [
  {
    title: "Sense the room.",
    body: "Combine occupancy, indoor and outdoor temperature, humidity, and hot or cold votes.",
  },
  {
    title: "Respond to people.",
    body: "Keep occupied rooms within a comfort band. Relax the target when a room is empty or closed.",
  },
  {
    title: "Make the impact visible.",
    body: "Compare the same room at a fixed temperature with our model. See the difference in electricity, cost, and CO₂e.",
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
          An empty classroom and a full reading room need different responses.
          HackIoT brings room conditions and people’s feedback into one model
          for heating and cooling.
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
            Holding one temperature can mean cooling an empty room or keeping a
            class colder than people want. Our model adapts the target to who is
            there and how they feel, then calls for heat, cool, or hold.
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
      </section>

      <LandingSimulator />
    </div>
  );
}
