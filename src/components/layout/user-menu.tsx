"use client";

import { LogOut } from "lucide-react";
import type { Role } from "@prisma/client";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/features/auth/actions";
import { roleLabel } from "@/features/users/schemas";

export function UserMenu({
  user,
}: {
  user: { name: string | null; email: string; image: string | null; role: Role };
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hover:bg-surface-muted focus-visible:ring-ring flex items-center gap-2 rounded-md p-1 focus-visible:ring-2 focus-visible:outline-none"
        aria-label="Account menu"
      >
        <Avatar user={user} />
        <span className="hidden text-left text-sm leading-tight sm:block">
          <span className="block font-medium">{user.name ?? user.email}</span>
          <span className="text-muted block text-xs">{roleLabel[user.role]}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOutAction()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
