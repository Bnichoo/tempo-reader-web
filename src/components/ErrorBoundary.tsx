import React from "react";
import type { ErrorInfo } from "react";
import { captureException } from "../lib/logger";

type Props = { fallback?: React.ReactNode; children: React.ReactNode };
type State = { hasError: boolean; err?: unknown };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(err: unknown): State { return { hasError: true, err }; }
  componentDidCatch(err: unknown, info: ErrorInfo) {
    try { captureException(err, { from: "ErrorBoundary", componentStack: info?.componentStack }); } catch {}
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-4 m-4 border border-red-200 bg-red-50 rounded">
          <div className="font-semibold text-red-900 mb-2">Something went wrong.</div>
          <div className="text-sm text-red-800 mb-3">Try reloading the page. If the issue persists, consider clearing the app's saved data.</div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded border border-red-300 bg-white hover:bg-red-100" onClick={() => window.location.reload()}>Reload</button>
            <button className="px-3 py-1.5 rounded border border-red-300 bg-white hover:bg-red-100" onClick={() => { try { localStorage.clear(); indexedDB.databases?.().then((dbs)=>dbs?.forEach(d=>d.name && indexedDB.deleteDatabase(d.name!))); } catch {} window.location.reload(); }}>Clear data & reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
