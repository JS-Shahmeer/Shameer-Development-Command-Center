"use client";

import { Copy, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ReportActions({ markdown }: { markdown: string }) {
  return (
    <>
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(markdown);
            toast.success("Report copied as Markdown");
          } catch {
            toast.error("Couldn't copy. Your browser blocked clipboard access.");
          }
        }}
      >
        <Copy /> Copy as Markdown
      </Button>
      <Button variant="secondary" onClick={() => window.print()}>
        <Printer /> Print
      </Button>
    </>
  );
}
