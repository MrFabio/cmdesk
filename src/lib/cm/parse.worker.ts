import { parseSave } from "./parse.ts";

type Request = { buffer: ArrayBuffer; fileName: string };

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

scope.onmessage = (event) => {
  try {
    const save = parseSave(event.data.buffer, event.data.fileName, (update) => {
      scope.postMessage({ type: "progress", pct: update.pct, label: update.label });
    });
    const attrs = save.attrs;
    scope.postMessage({ type: "done", save: { ...save, attrs: new Int8Array() }, attrs }, [attrs.buffer]);
  } catch (error) {
    scope.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Could not read that save.",
    });
  }
};
