import Link from "next/link";
import { Terminal } from "lucide-react";
import { requireUser } from "@/lib/session";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh">
      <aside className="bg-surface sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r px-3 py-4 md:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2.5 font-semibold">
          <span className="bg-primary text-primary-foreground rounded-md p-1">
            <Terminal className="size-4" aria-hidden />
          </span>
          Command Center
        </Link>
        <SidebarNav role={user.role} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <MobileNav role={user.role} />
            <span className="font-semibold md:hidden">Command Center</span>
          </div>
          <UserMenu user={user} />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
