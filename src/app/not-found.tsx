import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-muted font-mono text-sm">404</p>
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-muted max-w-sm text-sm">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Button asChild variant="secondary">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
