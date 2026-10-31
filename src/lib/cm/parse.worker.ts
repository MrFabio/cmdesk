import { parseSave } from "./parse.ts";
import { transferList } from "./players.ts";

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
    scope.postMessage({ type: "done", save }, transferList(save));
  } catch (error) {
    scope.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Could not read that save.",
    });
  }
};

scope.postMessage({ type: "ready" });
