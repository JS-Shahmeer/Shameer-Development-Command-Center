import { cn } from "@/lib/utils";
import type { Workload } from "../service";

/** Open estimated hours against weekly capacity. Over 100% means more than a week of work queued. */
export function WorkloadBar({ workload, className }: { workload: Workload; className?: string }) {
  const pct = Number.isFinite(workload.load) ? Math.round(workload.load * 100) : null;
  const tone = pct === null || pct > 100 ? "bg-danger" : pct > 80 ? "bg-warning" : "bg-success";
  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted">
          {workload.openHours}h open / {workload.capacityHours}h a week
        </span>
        <span className={cn("font-medium tabular-nums", (pct === null || pct > 100) && "text-danger")}>
          {pct === null ? "No capacity" : `${pct}%`}
        </span>
      </div>
      <div
        className="bg-surface-muted h-1.5 overflow-hidden rounded-full"
        role="meter"
        aria-label="Workload"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(pct ?? 100, 100)}
      >
        <div className={cn("h-full", tone)} style={{ width: `${Math.min(pct ?? 100, 100)}%` }} />
      </div>
      {workload.unestimated > 0 && (
        <p className="text-muted mt-1 text-xs">
          {workload.unestimated} open {workload.unestimated === 1 ? "task has" : "tasks have"} no estimate
        </p>
      )}
    </div>
  );
}
