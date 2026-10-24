import type { HvacAction } from "../../lib/thermal";

export function ActionBadge({ action }: { action: HvacAction }) {
  return <span className={`badge ${action}`}>{action}</span>;
}
