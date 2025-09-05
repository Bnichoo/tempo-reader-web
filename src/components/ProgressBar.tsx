import React from "react";

export const ProgressBar: React.FC<{ current: number; total: number }> = ({ current, total }) => {
  if (total <= 0) return null;
  const pct = Math.min(100, Math.max(0, (current / Math.max(1, total - 1)) * 100));
  return (
    <div className="absolute left-0 right-0 top-0 h-1 bg-sepia-200/60 rounded-full overflow-hidden">
      <div className="h-full bg-sepia-500" style={{ width: `${pct}%` }} />
    </div>
  );
};

