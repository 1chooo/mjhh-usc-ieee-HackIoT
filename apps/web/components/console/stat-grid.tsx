export function StatGrid({
  items,
}: {
  items: { label: string; value: string; tone?: "save" | "spend" }[];
}) {
  return (
    <dl className="stat-grid">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd className={item.tone ? `${item.tone} whitespace-normal` : "whitespace-normal"}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
