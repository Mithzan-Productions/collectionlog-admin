import { parseColored } from "@/lib/colors";

export function ColoredText({ raw, fallback }: { raw: string | null | undefined; fallback?: string }) {
  if (!raw) return <span>{fallback ?? ""}</span>;
  const runs = parseColored(raw);
  if (runs.length === 0) return <span>{fallback ?? raw}</span>;
  return (
    <span>
      {runs.map((run, i) => (
        <span key={i} style={run.color ? { color: run.color } : undefined}>
          {run.text}
        </span>
      ))}
    </span>
  );
}
