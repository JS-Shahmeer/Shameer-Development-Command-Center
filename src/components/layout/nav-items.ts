import type { Role } from "@prisma/client";
import { Building2, FolderKanban, LayoutDashboard, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; roles?: Role[] };

// Only live features appear here; later phases add Tasks, Team, Reports.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/clients", label: "Clients", icon: Building2, roles: ["ADMIN", "LEAD"] },
  { href: "/settings/users", label: "Users", icon: Users, roles: ["ADMIN"] },
];

export const navFor = (role: Role) => NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(role));
