"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { SidebarNav } from "./sidebar-nav";

export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
          <Menu />
        </Button>
      </DialogTrigger>
      <DialogContent title="Navigation" className="max-w-xs">
        <SidebarNav role={role} onNavigate={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
