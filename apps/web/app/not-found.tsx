import Link from "next/link";

export default function NotFound() {
  return (
    <div className="stack">
      <header className="page-head">
        <h1>That space is not in the demo.</h1>
      </header>
      <Link className="button" href="/dashboard">
        Back to the dashboard
      </Link>
    </div>
  );
}
