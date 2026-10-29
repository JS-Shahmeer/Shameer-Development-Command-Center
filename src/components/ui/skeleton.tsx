import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bg-surface-muted animate-pulse rounded-md", className)} aria-hidden />;
}
