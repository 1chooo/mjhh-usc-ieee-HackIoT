import Link from "next/link";

export default function NotFound() {
  return (
    <div className="stack">
      <header className="page-head">
        <p className="eyebrow">Missing room</p>
        <h1>That space is not in the demo.</h1>
        <p className="lede">
          Choose one of the simulated library or classroom rooms.
        </p>
      </header>
      <Link className="button" href="/rooms">
        Back to rooms
      </Link>
    </div>
  );
}
