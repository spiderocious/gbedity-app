import { useEffect, useRef } from "react";

import { ENV } from "../config/env.ts";
import { LogEvent } from "./events.ts";

// A small structured debug logger for deep flow debugging (socket churn, stage-machine transitions,
// submit paths). Goals:
//   - One event vocabulary (events.ts), never raw strings → greppable + mutable per-event.
//   - Rich data + a timestamp + a component tag on every line, printed copy-paste-friendly.
//   - ENV-GATED: off unless VITE_DEBUG_LOG is on (always available in dev; opt-in in prod).
//   - Per-event MUTE so noisy events (e.g. ws_view_received) can be silenced without code changes.
//   - Scoped child loggers that auto-attach a component tag.
//
// It is deliberately console-based (no transport): this is a developer debugging aid, not telemetry.

type LogData = Record<string, unknown>;

interface LogOptions {
  /** Component / context tag for this single event (overrides a scope tag). */
  readonly component?: string;
}

// ── enable / mute state ──────────────────────────────────────────────────────
// Enabled when VITE_DEBUG_LOG is truthy, OR in dev by default, OR toggled at runtime via the global.
function envEnabled(): boolean {
  const flag = (import.meta.env.VITE_DEBUG_LOG as string | undefined) ?? "";
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return ENV.APP_ENV !== "production";
}

let enabled = envEnabled();
// Console-muted BY DEFAULT (still captured in the export buffer): the highest-volume events. They'd
// flood the live console but are gold in an exported log. Unmute any with __gbedityLog.unmute('…').
const muted = new Set<string>([
  "flow_render", // fires every flow render
  "flow_patch_full", // the entire patch object (big)
  "ws_view_received", // the hot socket path
]);

// ── in-memory ring buffer (for export) ───────────────────────────────────────
// Every emitted event is appended here (independent of console muting) so a whole session can be
// exported as text and pasted into a bug report. Capped so a long session can't grow unbounded.
interface BufferEntry {
  readonly t: string; // wall-clock HH:MM:SS.mmm
  readonly ms: number; // elapsed since first import
  readonly event: string;
  readonly component: string;
  readonly data: LogData | undefined;
}
const BUFFER_MAX = 5000;
const buffer: BufferEntry[] = [];
function record(entry: BufferEntry): void {
  buffer.push(entry);
  if (buffer.length > BUFFER_MAX) buffer.splice(0, buffer.length - BUFFER_MAX);
}

// JSON-safe stringify of arbitrary log data (handles circular refs + trims huge strings/arrays so an
// exported log stays readable).
function safe(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== "object") {
    if (typeof value === "string" && value.length > 400)
      return `${value.slice(0, 400)}…(+${value.length - 400})`;
    return value;
  }
  if (depth > 6) return "…";
  if (Array.isArray(value)) {
    const arr = value.slice(0, 50).map((v) => safe(v, depth + 1));
    if (value.length > 50) arr.push(`…(+${value.length - 50} more)`);
    return arr;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>))
    out[k] = safe(v, depth + 1);
  return out;
}

function formatEntry(e: BufferEntry): string {
  let dataStr = "";
  if (e.data && Object.keys(e.data).length > 0) {
    try {
      dataStr = ` ${JSON.stringify(safe(e.data))}`;
    } catch {
      dataStr = " [unserializable]";
    }
  }
  return `${e.t} +${e.ms}ms  ${e.event}  (${e.component})${dataStr}`;
}

// Monotonic-ish elapsed clock so a copied log is easy to read (ms since first import). We avoid
// Date.now() churn in the visible output but still print a wall-clock time string per line.
const startedAt = typeof performance !== "undefined" ? performance.now() : 0;
function elapsedMs(): number {
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  return Math.round(now - startedAt);
}
function clockString(): string {
  // HH:MM:SS.mmm — local wall clock, easy to correlate with backend logs.
  const d = new Date();
  const p = (n: number, w = 2): string => n.toString().padStart(w, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

// Domain prefix (before the first underscore) → a colour, so the console scans fast.
const PREFIX_COLOR: Record<string, string> = {
  app: "#7B4FBF",
  nav: "#2D5BFF",
  api: "#1F9A60",
  ws: "#E8731A",
  room: "#C44035",
  lobby: "#2F5C46",
  config: "#536A62",
  flow: "#2D5BFF",
  stage: "#D9A813",
  game: "#27B973",
  ui: "#9CB3AB",
};
function colorFor(event: string): string {
  const prefix = event.slice(0, event.indexOf("_"));
  return PREFIX_COLOR[prefix] ?? "#536A62";
}

function emit(
  event: string,
  data: LogData | undefined,
  component: string | undefined,
): void {
  if (!enabled) return;
  const tag = component ?? "—";
  // Always buffer (even console-muted events) so the export is complete; only skip the console print.
  record({ t: clockString(), ms: elapsedMs(), event, component: tag, data });
  if (muted.has(event)) return;
  const color = colorFor(event);
  const time = clockString();
  // A compact, copy-friendly grouped line: [time +elapsed] EVENT (component) { …data }
  // eslint-disable-next-line no-console
  console.log(
    `%c${time} %c+${elapsedMs()}ms %c${event} %c(${tag})`,
    "color:#9CB3AB",
    "color:#C7D6CF",
    `color:${color};font-weight:700`,
    "color:#536A62",
    data ?? {},
  );
  // console.table(
  //   { time,
  //     elapsed: `+${elapsedMs()}ms`,
  //     event,
  //     component: tag,
  //     ...data,
  //   },
  //   ['time', 'elapsed', 'event', 'component', ...(data ? Object.keys(data) : [])],
  // )
}

export interface Logger {
  /** Fire a structured event. `name` must come from LogEvent (events.ts). */
  event(name: string, data?: LogData, opts?: LogOptions): void;
  /** A child logger that auto-attaches `component` to every event. */
  scope(component: string): Logger;
}

function makeLogger(scopeComponent?: string): Logger {
  return {
    event(name, data, opts) {
      emit(name, data, opts?.component ?? scopeComponent);
    },
    scope(component) {
      return makeLogger(component);
    },
  };
}

export const log: Logger & {
  /** Toggle all logging at runtime (also exposed on window.__gbedityLog). */
  setEnabled(on: boolean): void;
  /** Mute / unmute a single event name (e.g. the hot ws_view_received). */
  mute(...events: string[]): void;
  unmute(...events: string[]): void;
  /** Inspect current state. */
  state(): { enabled: boolean; muted: string[] };
  /** The full captured session as plain text (newest last) — paste this into a bug report. */
  export(): string;
  /** Trigger a browser download of the session log as a .txt file. */
  download(filename?: string): void;
  /** Drop the captured buffer (start a clean repro). */
  clear(): void;
  /** Number of buffered entries. */
  size(): number;
} = {
  ...makeLogger(),
  setEnabled(on) {
    enabled = on;
  },
  mute(...events) {
    events.forEach((e) => muted.add(e));
  },
  unmute(...events) {
    events.forEach((e) => muted.delete(e));
  },
  state() {
    return { enabled, muted: [...muted] };
  },
  export() {
    const header = `# Gbedity debug log — ${buffer.length} events — exported ${clockString()}\n`;
    return header + buffer.map(formatEntry).join("\n");
  },
  download(filename) {
    if (typeof document === "undefined") return;
    const text = this.export();
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? `gbedity-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  },
  clear() {
    buffer.length = 0;
  },
  size() {
    return buffer.length;
  },
};

// Component lifecycle helper: logs `ui_mounted` / `ui_unmounted` with the component name + optional
// data, exactly once per mount. Use at the top of a component you want to trace mounting/remounting
// (the flow remount bug lives here). `data` is captured once on mount.
export function useLogMount(component: string, data?: LogData): void {
  const dataRef = useRef(data);
  dataRef.current = data;
  useEffect(() => {
    log.event(LogEvent.UI_MOUNTED, dataRef.current, { component });
    return () => {
      log.event(LogEvent.UI_UNMOUNTED, undefined, { component });
    };
    // Mount-only: we want one mounted/unmounted pair per real mount, not per data change.
  }, [component]);
}

// Expose a runtime handle so you can flip logging / mute from the devtools console without a rebuild:
//   __gbedityLog.setEnabled(true); __gbedityLog.mute('ws_view_received');
if (typeof window !== "undefined") {
  (window as unknown as { __gbedityLog: typeof log }).__gbedityLog = log;
}
