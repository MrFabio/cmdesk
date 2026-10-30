import { parseSave } from "./parse.ts";
import type { ParsedSave, ProgressUpdate } from "./types.ts";

type Done = { type: "done"; save: ParsedSave; attrs: Int8Array };
type Progress = { type: "progress"; pct: number; label: string };
type Fail = { type: "error"; message: string };

export function loadSave(
  buffer: ArrayBuffer,
  fileName: string,
  onProgress?: (update: ProgressUpdate) => void,
): Promise<ParsedSave> {
  return new Promise((resolve, reject) => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("./parse.worker.ts", import.meta.url), { type: "module" });
    } catch {
      worker = null;
    }
    if (!worker) {
      try {
        resolve(parseSave(buffer, fileName, onProgress));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Could not read that save."));
      }
      return;
    }

    let settled = false;
    const finish = (save: ParsedSave) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      worker?.terminate();
      resolve(save);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      worker?.terminate();
      reject(error);
    };
    const timer = window.setTimeout(() => fail(new Error("Reading the save took too long.")), 90_000);

    worker.onmessage = (event: MessageEvent<Done | Progress | Fail>) => {
      const data = event.data;
      if (data.type === "progress") onProgress?.({ pct: data.pct, label: data.label });
      else if (data.type === "done") {
        data.save.attrs = data.attrs;
        finish(data.save);
      } else fail(new Error(data.message));
    };
    worker.onerror = () => {
      worker?.terminate();
      if (settled) return;
      try {
        finish(parseSave(buffer, fileName, onProgress));
      } catch (error) {
        fail(error instanceof Error ? error : new Error("Could not read that save."));
      }
    };
    worker.postMessage({ buffer, fileName });
  });
}
