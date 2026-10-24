import type { ActionFilter, KindFilter } from "../../lib/campus-summary";
import { cn } from "../../lib/utils";

const kinds: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All rooms" },
  { id: "library", label: "Library" },
  { id: "classroom", label: "Classroom" },
];

const actions: { id: ActionFilter; label: string }[] = [
  { id: "all", label: "All calls" },
  { id: "cool", label: "Cool" },
  { id: "heat", label: "Heat" },
  { id: "hold", label: "Hold" },
];

function Chip({
  pressed,
  label,
  onClick,
}: {
  pressed: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm",
        pressed
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-accent",
      )}
    >
      {label}
    </button>
  );
}

export function RoomFilters({
  kind,
  action,
  onKind,
  onAction,
  onClear,
}: {
  kind: KindFilter;
  action: ActionFilter;
  onKind: (kind: KindFilter) => void;
  onAction: (action: ActionFilter) => void;
  onClear: () => void;
}) {
  const filtered = kind !== "all" || action !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {kinds.map((item) => (
        <Chip
          key={item.id}
          label={item.label}
          pressed={kind === item.id}
          onClick={() => onKind(item.id)}
        />
      ))}
      <span className="mx-1 h-4 w-px bg-[var(--line)]" aria-hidden="true" />
      {actions.map((item) => (
        <Chip
          key={item.id}
          label={item.label}
          pressed={action === item.id}
          onClick={() => onAction(item.id)}
        />
      ))}
      {filtered ? (
        <button type="button" className="ghost" onClick={onClear}>
          Clear
        </button>
      ) : null}
    </div>
  );
}
