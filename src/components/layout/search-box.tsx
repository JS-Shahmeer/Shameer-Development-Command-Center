"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Header search. Press "/" or Ctrl/Cmd+K from anywhere to focus it. */
export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      className="relative w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        const q = ref.current?.value.trim() ?? "";
        if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <Search
        className="text-muted pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
        aria-hidden
      />
      <Input
        ref={ref}
        name="q"
        type="search"
        defaultValue={params.get("q") ?? ""}
        key={params.get("q") ?? ""}
        placeholder="Search projects, tasks, notes, people"
        aria-label="Search everything"
        className="h-8 pr-12 pl-8"
      />
      <kbd className="bg-surface-muted text-muted pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border px-1.5 font-mono text-[10px] sm:block">
        Ctrl K
      </kbd>
    </form>
  );
}
