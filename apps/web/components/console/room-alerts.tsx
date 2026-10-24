import { X } from "lucide-react";
import type { AlertSeverity, CampusAlert } from "../../lib/campus-summary";

const tones: Record<AlertSeverity, string> = {
  high: "border-[color-mix(in_oklch,var(--spend)_40%,transparent)]",
  medium: "border-[color-mix(in_oklch,var(--hot)_40%,transparent)]",
  low: "border-[color-mix(in_oklch,var(--cold)_40%,transparent)]",
};

export function RoomAlerts({
  alerts,
  onDismiss,
}: {
  alerts: CampusAlert[];
  onDismiss: (id: string) => void;
}) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-2">
      {alerts.map((alert) => (
        <li
          key={alert.id}
          className={`flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 ${tones[alert.severity]}`}
        >
          <p>{alert.title}</p>
          <button
            type="button"
            className="rounded-md p-1 hover:bg-accent"
            aria-label={`Dismiss ${alert.title}`}
            onClick={() => onDismiss(alert.id)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
