type LogLevel = "debug" | "info" | "warn" | "error";

type LogEvent = {
  level: LogLevel;
  msg: string;
  time: string; // ISO string
  context?: Record<string, unknown>;
  error?: unknown;
};

let sink: ((e: LogEvent) => void) | null = null;

export function setTelemetrySink(fn: ((e: LogEvent) => void) | null) {
  sink = fn;
}

export function isDebugEnabled(): boolean {
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("tr:debug") === "1") return true;
  } catch { /* ignore: localStorage unavailable */ }
  // Vite: prefer explicit env
  try {
    const env: any = (import.meta as any)?.env;
    if (env?.VITE_DEBUG === "1") return true;
    return !!(env?.MODE === "development");
  } catch { /* ignore: env unavailable */ }
  return false;
}

function emit(level: LogLevel, msg: string, context?: Record<string, unknown>, error?: unknown) {
  const evt: LogEvent = { level, msg, time: new Date().toISOString(), context, error };
  try {
    if (sink) sink(evt);
  } catch { /* ignore: telemetry sink failed */ }
  try {
    const line = `[${evt.time}] ${level.toUpperCase()}: ${msg}`;
    if (level === "debug") { if (isDebugEnabled()) console.debug(line, context ?? ""); }
    else if (level === "info") console.info(line, context ?? "");
    else if (level === "warn") console.warn(line, context ?? "");
    else console.error(line, error ?? context ?? "");
  } catch { /* ignore: console may be unavailable */ }
}

export const logger = {
  debug: (msg: string, context?: Record<string, unknown>) => emit("debug", msg, context),
  info:  (msg: string, context?: Record<string, unknown>) => emit("info", msg, context),
  warn:  (msg: string, context?: Record<string, unknown>) => emit("warn", msg, context),
  error: (msg: string, error?: unknown, context?: Record<string, unknown>) => emit("error", msg, context, error),
};

export function captureException(error: unknown, context?: Record<string, unknown>) {
  emit("error", "exception", context, error);
}

export function initGlobalErrorHandlers() {
  if (typeof window === "undefined") return;
  const onError = (msg: Event | string, src?: string, lineno?: number, colno?: number, err?: Error) => {
    captureException(err ?? msg, { src, lineno, colno });
    return false; // don't block default
  };
  const onRejection = (ev: PromiseRejectionEvent) => {
    captureException(ev.reason ?? "unhandledrejection");
  };
  window.addEventListener("error", onError as EventListener);
  window.addEventListener("unhandledrejection", onRejection);
}
