import Link from "next/link";
import styles from "./references.module.css";

/** IEEE in-text citation. `n` matches an id on /reference. */
export function Cite({ n }: { n: number }) {
  return (
    <Link
      className={styles.cite}
      href={`/reference#ref-${n}`}
      aria-label={`Reference ${n}`}
    >
      [{n}]
    </Link>
  );
}
