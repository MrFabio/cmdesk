import { FolderOpen } from "lucide-react";
import type { ProgressUpdate } from "@/lib/cm/types";
import { button, buttonPrimary } from "./ui";

export function OpenView({
  busy,
  error,
  over,
  onPick,
  onSample,
}: {
  busy: ProgressUpdate | null;
  error: string | null;
  over: boolean;
  onPick: () => void;
  onSample: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 py-10">
      <p className="font-mono text-xs tracking-wide text-accent">01/02 · READ ONLY</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">CMdesk</h1>
      <p className="mt-3 text-sm text-muted">
        An online Championship Manager 01/02 save viewer, not a save editor. Open a CM 01/02 .sav and read the squad,
        the contract, and who is free, listed, listed for loan, or on loan. Nothing is uploaded.
      </p>

      <div
        className={`mt-8 rounded-sm border px-5 py-8 text-center ${over ? "border-accent bg-surface" : "border-line bg-surface"}`}
      >
        <FolderOpen className="mx-auto size-6 text-accent" aria-hidden="true" />
        <p className="mt-3 text-sm">Drop a .sav file here</p>
        <p className="mt-1 text-xs text-faint">The file stays in this browser. It is not uploaded.</p>
        <div className="mt-5 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          <button type="button" className={buttonPrimary} onClick={onPick} disabled={!!busy}>
            Choose a save
          </button>
          <button type="button" className={button} onClick={onSample} disabled={!!busy}>
            Load the sample career
          </button>
        </div>
      </div>

      {busy ? (
        <div className="mt-4" aria-live="polite">
          <div className="mb-1 flex justify-between font-mono text-xs text-muted">
            <span>{busy.label}</span>
            <span>{busy.pct}%</span>
          </div>
          <div className="h-1 bg-surface-2">
            <div className="h-1 bg-accent" style={{ width: `${Math.max(2, Math.min(100, busy.pct))}%` }} />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 border border-danger px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <p className="mt-8 text-xs text-faint">
        The sample is a fictional Albion league, so the preview works before you have a real career. A link to a remote
        save can come later.
      </p>
      <p className="mt-6 text-xs text-faint">
        Not affiliated with Sports Interactive or Square Enix. Championship Manager is their trademark.
      </p>
    </main>
  );
}
