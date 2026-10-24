import type { CampusSummary } from "../../lib/campus-summary";

function Gauge({
  label,
  percent,
  color,
}: {
  label: string;
  percent: number;
  color: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const shown = Math.round(percent);

  return (
    <div
      className="flex flex-col items-center gap-2"
      role="img"
      aria-label={`${label} ${shown}%`}
    >
      <div className="relative h-28 w-28">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 112 112" aria-hidden="true">
          <circle
            cx="56"
            cy="56"
            r={radius}
            className="fill-none stroke-[var(--line)]"
            strokeWidth="8"
          />
          <circle
            cx="56"
            cy="56"
            r={radius}
            className={`fill-none ${color}`}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-lg font-semibold">{shown}%</span>
        </div>
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export function LoadGauges({ summary }: { summary: CampusSummary }) {
  const avoided =
    summary.baselineKwh <= 0 ? 0 : (summary.savedKwh / summary.baselineKwh) * 100;
  const occupied =
    summary.capacity <= 0 ? 0 : (summary.openPeople / summary.capacity) * 100;

  return (
    <div className="flex flex-wrap justify-center gap-12">
      <Gauge
        label="Avoided"
        percent={avoided}
        color={avoided < 0 ? "stroke-[var(--spend)]" : "stroke-[var(--save)]"}
      />
      <Gauge label="Occupied" percent={occupied} color="stroke-[var(--cold)]" />
    </div>
  );
}
