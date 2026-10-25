import {
  projectSources,
  references,
  type ReferenceLink,
} from "../lib/references";
import styles from "./references.module.css";

function SourceLink({ link }: { link: ReferenceLink }) {
  return (
    <a
      href={link.href}
      {...(link.external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {link.label}
      {link.external ? <span aria-hidden="true"> ↗</span> : null}
    </a>
  );
}

export function References() {
  return (
    <section
      className={`section ${styles.references}`}
      id="references"
      aria-labelledby="references-title"
    >
      <div className={styles.intro}>
        <h2 id="references-title">References</h2>
        <p>
          IEEE style, numbered in the order the home page cites them. The
          campus scale is the estimate these sources feed. The room comparison
          on the home page is a separate steady-state calculation. The cooling
          studies are of offices and other commercial buildings. The scale
          applies that factor to classrooms.
        </p>
      </div>
      <ol className={styles.list}>
        {references.map((entry) => (
          <li key={entry.id} id={`ref-${entry.id}`} className={styles.item}>
            <span className={styles.num}>[{entry.id}]</span>
            <div>
              <p className={styles.citation}>
                {entry.segments.map((segment) =>
                  segment.italic ? (
                    <cite key={segment.text}>{segment.text}</cite>
                  ) : (
                    <span key={segment.text}>{segment.text}</span>
                  ),
                )}
              </p>
              <p className={styles.note}>
                <span className={styles.label}>Used for</span>
                {entry.usedFor}
              </p>
              <p className={styles.note}>
                <span className={styles.label}>Where</span>
                {entry.links.map((link, index) => (
                  <span key={link.href}>
                    {index > 0 ? (
                      <span className={styles.sep} aria-hidden="true">
                        {" "}
                        ·{" "}
                      </span>
                    ) : null}
                    <SourceLink link={link} />
                  </span>
                ))}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className={styles.repo}>
        <h3>In this repository</h3>
        <p>
          Inputs with no published source, and the code that applies the
          references above. The path is the resource.
        </p>
        <ul className={styles.paths}>
          {projectSources.map((item) => (
            <li key={item.path}>
              <a
                className={styles.path}
                href={item.href}
                {...(item.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {item.path}
                {item.external ? <span aria-hidden="true"> ↗</span> : null}
              </a>
              <span>{item.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
