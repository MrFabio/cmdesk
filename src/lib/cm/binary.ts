const latin1 = new TextDecoder("iso-8859-1");

export function cstr(bytes: Uint8Array, start: number, max: number): string {
  let end = start;
  const limit = Math.min(bytes.length, start + max);
  while (end < limit && bytes[end] !== 0) end += 1;
  return latin1.decode(bytes.subarray(start, end)).trim();
}

export function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function i16(view: DataView, offset: number): number {
  return view.getInt16(offset, true);
}

export function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

export function i32(view: DataView, offset: number): number {
  return view.getInt32(offset, true);
}

/** Day is 0-based day-of-year, matching the game's date record. */
export function dateFrom(view: DataView, offset: number): Date | null {
  if (offset + 8 > view.byteLength) return null;
  const day = i16(view, offset);
  const year = i16(view, offset + 2);
  if (year < 1800 || year > 2300 || day < 0 || day > 400) return null;
  const date = new Date(Date.UTC(year, 0, 1));
  date.setUTCDate(date.getUTCDate() + day);
  return date;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function monthOrd(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

export function putCstr(bytes: Uint8Array, offset: number, text: string, max: number) {
  const n = Math.min(text.length, max);
  for (let i = 0; i < n; i += 1) {
    const code = text.charCodeAt(i);
    bytes[offset + i] = code > 255 ? 63 : code;
  }
}

export function compressBlock(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < src.length) {
    const value = src[i]!;
    let run = 1;
    while (i + run < src.length && src[i + run] === value && run < 126) run += 1;
    if (run === 1 && value <= 128) out.push(value);
    else {
      out.push(run + 128);
      out.push(value);
    }
    i += run;
  }
  return Uint8Array.from(out);
}
