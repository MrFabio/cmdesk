import { abilityBand, bandOf, moraleLevel } from "@/lib/cm/labels";
import { useSettings } from "@/lib/cm/settings";

export function Stat({
  value,
  kind,
  mute = true,
}: {
  value: number;
  kind: "attr" | "ability";
  mute?: boolean;
}) {
  const muteBelow = useSettings((state) => state.muteBelow);
  const band = kind === "ability" ? abilityBand(value) : bandOf(value);
  if (band === null) return <span className="font-mono text-faint">–</span>;
  if (mute && kind === "attr" && muteBelow > 0 && value < muteBelow) {
    return <span className="font-mono text-faint">{value}</span>;
  }
  return <span className={`font-mono attr-b${band}`}>{value}</span>;
}

export function MoraleText({ value, compact = false }: { value: number; compact?: boolean }) {
  const level = moraleLevel(value);
  const tone = level.band ? `attr-b${level.band}` : "text-faint";
  return (
    <span className={tone} title={compact && level.short !== level.label ? level.label : undefined}>
      {compact ? level.short : level.label}
    </span>
  );
}