import styles from "./algorithm-story.module.css";

/**
 * How the setpoint is chosen, drawn rather than told. Static: no state, no controls.
 * The numbers are the model's own (apps/alg/acmodel.py) and the group offsets are what the
 * simulator learned for its demo classes after three weeks.
 */

const N_MAX = 300;
const prior = (n: number) => 26 - (8 * (n - 1)) / 299;

// Setpoint-by-head-count chart (viewBox 680 × 360)
const X0 = 64;
const X1 = 650;
const Y0 = 24;
const Y1 = 304;
const T_MAX = 30;
const T_MIN = 16;
const x = (n: number) => X0 + (n / N_MAX) * (X1 - X0);
const y = (t: number) => Y0 + ((T_MAX - t) / (T_MAX - T_MIN)) * (Y1 - Y0);

// labelT: where the label sits (°C); labels for the crowded small classes sit out to the right
const groups = [
  { name: "MATH 125", people: 22, offset: 1.6, labelN: 95, labelT: 28.6 },
  { name: "Quiet stacks", people: 45, offset: 1.7, labelN: 95, labelT: 27.4 },
  { name: "WRIT 150", people: 36, offset: -1.0, labelN: 95, labelT: 21.6 },
  { name: "CSCI 270", people: 26, offset: -1.5, labelN: 95, labelT: 20.4 },
  { name: "BISC 120", people: 260, offset: 0.9, labelN: 248, labelT: 21.6 },
];

const week1 = [
  { time: "09:00", label: "WRIT 150", tag: "new group", temp: "25.0 → 24.0", kind: "new" },
  { time: "10:00", label: "WRIT 150", tag: "same group", temp: "24.0", kind: "same" },
  { time: "11:00", label: "MATH 125", tag: "new group", temp: "25.5 → 27.5", kind: "new" },
  { time: "12:00", label: "Empty", tag: "set back", temp: "26.0", kind: "empty" },
];
const week2 = [
  { time: "09:00", label: "WRIT 150", tag: "recognized", temp: "starts 24.0", kind: "known" },
  { time: "10:00", label: "WRIT 150", tag: "same group", temp: "24.0", kind: "same" },
  { time: "11:00", label: "MATH 125", tag: "recognized", temp: "starts 27.5", kind: "known" },
  { time: "12:00", label: "Empty", tag: "set back", temp: "26.0", kind: "empty" },
];

export function AlgorithmStory() {
  return (
    <section className={`section ${styles.story}`} id="algorithm" aria-labelledby="algorithm-title">
      <div className={styles.intro}>
        <h2 id="algorithm-title">How the setpoint is chosen</h2>
      </div>

      {/* 1. The formula */}
      <ol className={styles.formula} aria-label="Setpoint = crowd curve + group taste + vote fix">
        <li className={styles.term}>
          <strong>Crowd curve</strong>
          <svg viewBox="0 0 160 80" className={styles.mini} aria-hidden="true">
            <line x1="8" y1="72" x2="152" y2="72" className={styles.axis} />
            <line x1="8" y1="8" x2="8" y2="72" className={styles.axis} />
            <line x1="12" y1="16" x2="150" y2="60" className={styles.curve} />
            <circle cx="12" cy="16" r="3.5" className={styles.dotInk} />
            <circle cx="150" cy="60" r="3.5" className={styles.dotInk} />
          </svg>
        </li>
        <li className={styles.op} aria-hidden="true">+</li>
        <li className={styles.term}>
          <strong>Group taste</strong>
          <svg viewBox="0 0 160 80" className={styles.mini} aria-hidden="true">
            <line x1="8" y1="40" x2="152" y2="40" className={styles.baseline} />
            {[0, 1, 2, 3].map((w) => (
              <g key={w}>
                <line x1={28 + w * 36} y1="40" x2={28 + w * 36} y2={40 - 6 - w * 5} className={styles.stem} />
                <circle cx={28 + w * 36} cy={40 - 6 - w * 5} r="5" className={styles.dotWarm} />
              </g>
            ))}
          </svg>
        </li>
        <li className={styles.op} aria-hidden="true">+</li>
        <li className={styles.term}>
          <strong>Vote fix</strong>
          <svg viewBox="0 0 160 80" className={styles.mini} aria-hidden="true">
            <rect x="8" y="30" width="96" height="20" rx="4" className={styles.barHot} />
            <rect x="106" y="30" width="46" height="20" rx="4" className={styles.barCold} />
            <path d="M56 66 L56 74 M50 70 L56 76 L62 70" className={styles.arrow} />
          </svg>
        </li>
        <li className={styles.op} aria-hidden="true">=</li>
        <li className={`${styles.term} ${styles.result}`}>
          <strong>AC setpoint</strong>
          <span className={styles.big}>16–30°C</span>
        </li>
      </ol>

      <div className={styles.pair}>
        {/* 2. Setpoint by head count */}
        <figure className={styles.panel}>
          <figcaption>
            <h3>Same curve, different classes</h3>
          </figcaption>
          <div className={styles.chartBox}>
            <svg viewBox="0 0 680 360" className={styles.chart} role="img" aria-label="AC setpoint against head count. The starting line falls from 26°C at 1 person to 18°C at 300. Five classes sit above or below it by their learned offsets.">
              {[18, 20, 22, 24, 26, 28].map((t) => (
                <g key={t}>
                  <line x1={X0} x2={X1} y1={y(t)} y2={y(t)} className={styles.grid} />
                  <text x={X0 - 10} y={y(t) + 4} textAnchor="end" className={styles.tick}>{t}°</text>
                </g>
              ))}
              {[0, 100, 200, 300].map((n) => (
                <text key={n} x={x(n)} y={Y1 + 24} textAnchor="middle" className={styles.tick}>{n}</text>
              ))}
              <text x={(X0 + X1) / 2} y={Y1 + 48} textAnchor="middle" className={styles.axisLabel}>people in the room</text>
              <line x1={x(1)} y1={y(prior(1))} x2={x(300)} y2={y(prior(300))} className={styles.priorLine} />
              {groups.map((g) => {
                const base = prior(g.people);
                const top = base + g.offset;
                const warm = g.offset > 0;
                return (
                  <g key={g.name}>
                    <line x1={x(g.people)} x2={x(g.people)} y1={y(base)} y2={y(top)} className={warm ? styles.offWarm : styles.offCool} />
                    <circle cx={x(g.people)} cy={y(base)} r="3" className={styles.dotInk} />
                    <circle cx={x(g.people)} cy={y(top)} r="6" className={warm ? styles.dotWarm : styles.dotCool} />
                    <polyline
                      points={`${x(g.people) + 6},${y(top)} ${x(g.labelN) - 8},${y(g.labelT) - 5}`}
                      className={styles.leader}
                    />
                    <text x={x(g.labelN)} y={y(g.labelT)} textAnchor={g.labelN > g.people ? "start" : "end"} className={styles.groupLabel}>
                      {g.name} {g.offset > 0 ? "+" : "−"}{Math.abs(g.offset).toFixed(1)}°
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </figure>

        {/* 3. Recognition over two weeks */}
        <figure className={styles.panel}>
          <figcaption>
            <h3>The second week starts where the first one ended</h3>
          </figcaption>
          <div className={styles.weeks}>
            {[
              { name: "Week 1", cells: week1 },
              { name: "Week 2", cells: week2 },
            ].map((row) => (
              <div key={row.name} className={styles.weekRow}>
                <span className={styles.weekName}>{row.name}</span>
                {row.cells.map((c) => (
                  <div key={c.time} className={`${styles.cell} ${styles[c.kind]}`}>
                    <span className={styles.time}>{c.time}</span>
                    <strong>{c.label}</strong>
                    {c.kind === "new" || c.kind === "known" ? <span className={styles.tag}>{c.tag}</span> : null}
                    <span className={styles.temp}>{c.temp}°C</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </figure>
      </div>

      {/* 4. Vote rules */}
      <ul className={styles.rules} aria-label="Vote rules">
        <li>
          <svg viewBox="0 0 120 48" aria-hidden="true">
            <rect x="4" y="14" width="70" height="20" rx="4" className={styles.barHot} />
            <rect x="76" y="14" width="40" height="20" rx="4" className={styles.barCold} />
          </svg>
          <h4>Majority, not one voice</h4>
        </li>
        <li>
          <svg viewBox="0 0 120 48" aria-hidden="true">
            <path d="M20 24 H96 M84 14 L96 24 L84 34" className={styles.arrowCool} />
            <path d="M100 10 L112 38 M112 10 L100 38" className={styles.cross} />
          </svg>
          <h4>Only the way the votes point</h4>
        </li>
        <li>
          <svg viewBox="0 0 120 48" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <line key={i} x1={12 + i * 24} x2={12 + i * 24} y1="12" y2="36" className={styles.step} />
            ))}
            <line x1="12" x2="108" y1="24" y2="24" className={styles.baseline} />
          </svg>
          <h4>Half-degree steps</h4>
        </li>
        <li>
          <svg viewBox="0 0 120 48" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <circle key={i} cx={10 + i * 12} cy="24" r="4" className={styles.dotMuted} />
            ))}
            <text x="116" y="29" textAnchor="end" className={styles.tick}>&lt; 15</text>
          </svg>
          <h4>Drop-in hours stay gentle</h4>
        </li>
      </ul>

      {/* 5. One hour */}
      <figure className={styles.hour}>
        <figcaption>
          <h3>One hour on the Raspberry Pi</h3>
        </figcaption>
        <div className={styles.timelineBox}>
          <svg viewBox="0 0 900 150" className={styles.timeline} role="img" aria-label="An hour from :00 to :60. At :00 the class walks in and the camera counts heads. At :30 votes close and the model sets the AC. At :45 it can pre-set the AC for the class it expects next.">
            <line x1="40" x2="860" y1="70" y2="70" className={styles.track} />
            {[0, 15, 30, 45, 60].map((m) => (
              <g key={m}>
                <line x1={40 + (m / 60) * 820} x2={40 + (m / 60) * 820} y1="62" y2="78" className={styles.axis} />
                <text x={40 + (m / 60) * 820} y="100" textAnchor="middle" className={styles.tick}>:{String(m).padStart(2, "0")}</text>
              </g>
            ))}
            <rect x="40" y="62" width={(30 / 60) * 820} height="16" rx="8" className={styles.voteWindow} />
            <circle cx="40" cy="70" r="9" className={styles.dotInk} />
            <circle cx={40 + 0.5 * 820} cy="70" r="11" className={styles.dotWarm} />
            <circle cx={40 + 0.75 * 820} cy="70" r="9" className={styles.dotCool} />
            <text x="40" y="36" className={styles.groupLabel}>Class walks in · camera counts</text>
            <text x={40 + 0.5 * 820} y="36" textAnchor="middle" className={styles.groupLabel}>Votes close · update() sets the AC</text>
            <text x={40 + 0.75 * 820 + 6} y="132" textAnchor="middle" className={styles.groupLabel}>next_hour() pre-sets the next class</text>
          </svg>
        </div>
      </figure>
    </section>
  );
}
