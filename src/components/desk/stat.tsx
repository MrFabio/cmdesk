import { abilityBand, bandOf } from "@/lib/cm/labels";
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