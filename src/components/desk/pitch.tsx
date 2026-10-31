import type { ReactNode } from "react";
import { playedSpots, type PitchSpot } from "@/lib/cm/positions";

/**
 * Shared pitch markings. Portrait is the match board (goals top and bottom).
 * Landscape is the player position map (own goal on the left).
 */
export function PitchOutline({
  orientation,
  label,
  tone = "paper",
  children,
}: {
  orientation: "portrait" | "landscape";
  label?: string;
  tone?: "paper" | "grass";
  children?: ReactNode;
}) {
  const grass = tone === "grass";
  const fill = grass ? "fill-pitch" : "fill-surface";
  const stroke = grass ? "stroke-pitch-line" : "stroke-line";
  const mark = grass ? "fill-pitch-line" : "fill-line";
  const portrait = orientation === "portrait";
  return (
    <svg
      viewBox={portrait ? "0 0 100 150" : "0 0 150 100"}
      className="block h-auto w-full"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {portrait ? (
        <PortraitMarks fill={fill} stroke={stroke} mark={mark} />
      ) : (
        <LandscapeMarks fill={fill} stroke={stroke} mark={mark} />
      )}
      {children}
    </svg>
  );
}

function PortraitMarks({ fill, stroke, mark }: { fill: string; stroke: string; mark: string }) {
  return (
    <>
      <rect x="0.5" y="0.5" width="99" height="149" className={`${fill} ${stroke}`} strokeWidth="1" />
      <line x1="0" y1="75" x2="100" y2="75" className={stroke} strokeWidth="1" />
      <circle cx="50" cy="75" r="12" className={`fill-none ${stroke}`} strokeWidth="1" />
      <circle cx="50" cy="75" r="0.8" className={mark} />
      <rect x="22" y="0" width="56" height="22" className={`fill-none ${stroke}`} strokeWidth="1" />
      <rect x="36" y="0" width="28" height="8" className={`fill-none ${stroke}`} strokeWidth="1" />
      <rect x="22" y="128" width="56" height="22" className={`fill-none ${stroke}`} strokeWidth="1" />
      <rect x="36" y="142" width="28" height="8" className={`fill-none ${stroke}`} strokeWidth="1" />
    </>
  );
}

function LandscapeMarks({ fill, stroke, mark }: { fill: string; stroke: string; mark: string }) {
  return (
    <>
      <rect x="0.5" y="0.5" width="149" height="99" className={`${fill} ${stroke}`} strokeWidth="1" />
      <line x1="75" y1="0" x2="75" y2="100" className={stroke} strokeWidth="1" />
      <circle cx="75" cy="50" r="9" className={`fill-none ${stroke}`} strokeWidth="1" />
      <circle cx="75" cy="50" r="0.7" className={mark} />
      <rect x="0" y="22" width="22" height="56" className={`fill-none ${stroke}`} strokeWidth="1" />
      <rect x="0" y="36" width="8" height="28" className={`fill-none ${stroke}`} strokeWidth="1" />
      <rect x="128" y="22" width="22" height="56" className={`fill-none ${stroke}`} strokeWidth="1" />
      <rect x="142" y="36" width="8" height="28" className={`fill-none ${stroke}`} strokeWidth="1" />
    </>
  );
}

/** ViewBox 150×100. Attack to the right, left wing along the top. */
const SPOTS: { id: PitchSpot; x: number; y: number; title: string }[] = [
  { id: "GK", x: 16, y: 50, title: "Goalkeeper" },
  { id: "DL", x: 48, y: 16, title: "Defender, left" },
  { id: "DC", x: 48, y: 50, title: "Defender, centre" },
  { id: "DR", x: 48, y: 84, title: "Defender, right" },
  { id: "DML", x: 66, y: 24, title: "Defensive mid, left" },
  { id: "DMC", x: 66, y: 50, title: "Defensive mid, centre" },
  { id: "DMR", x: 66, y: 76, title: "Defensive mid, right" },
  { id: "ML", x: 90, y: 14, title: "Midfielder, left" },
  { id: "MC", x: 90, y: 50, title: "Midfielder, centre" },
  { id: "MR", x: 90, y: 86, title: "Midfielder, right" },
  { id: "AML", x: 112, y: 24, title: "Attacking mid, left" },
  { id: "AMC", x: 112, y: 50, title: "Attacking mid, centre" },
  { id: "AMR", x: 112, y: 76, title: "Attacking mid, right" },
  { id: "FL", x: 132, y: 32, title: "Forward, left" },
  { id: "FC", x: 141, y: 50, title: "Forward, centre" },
  { id: "FR", x: 132, y: 68, title: "Forward, right" },
];

export function PositionPitch({
  posMask,
  sideMask,
  label,
}: {
  posMask: number;
  sideMask: number;
  label: string;
}) {
  const played = playedSpots(posMask, sideMask);
  return (
    <figure className="ml-auto w-28 shrink-0 @min-[32rem]:w-40">
      <PitchOutline orientation="landscape" tone="grass">
        {SPOTS.map((spot) => {
          const on = played.has(spot.id);
          return (
            <circle
              key={spot.id}
              cx={spot.x}
              cy={spot.y}
              r={on ? 6.2 : 4}
              className={on ? "fill-pitch-play stroke-pitch-line" : "fill-pitch-spot"}
              strokeWidth={on ? 0.6 : 0}
            >
              <title>{on ? `Plays ${spot.title}` : spot.title}</title>
            </circle>
          );
        })}
        <text x="12" y="14" fontSize="8" className="fill-pitch-line font-mono">
          L
        </text>
        <text x="12" y="94" fontSize="8" className="fill-pitch-line font-mono">
          R
        </text>
      </PitchOutline>
      <figcaption className="mt-1 text-center font-mono text-xs leading-tight">{label}</figcaption>
    </figure>
  );
}
