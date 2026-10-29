"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="border-danger/30 bg-danger/5 flex flex-col items-center justify-center rounded-lg border px-6 py-12 text-center">
      <AlertTriangle className="text-danger mb-3 size-6" aria-hidden />
      <p className="font-medium">Something went wrong</p>
      <p className="text-muted mt-1 max-w-sm text-sm">
        {message ?? "We couldn't load this page. Try again, and contact an admin if it keeps happening."}
      </p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
