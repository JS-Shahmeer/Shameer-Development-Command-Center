import type { Role } from "@prisma/client";
import {
  Building2,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; roles?: Role[] };

// Only live features appear here; Phase 3 adds Search and Reports.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "My tasks", icon: ListTodo },
  { href: "/team", label: "Team", icon: Users, roles: ["ADMIN", "LEAD"] },
  { href: "/clients", label: "Clients", icon: Building2, roles: ["ADMIN", "LEAD"] },
  { href: "/settings/users", label: "Users", icon: UserCog, roles: ["ADMIN"] },
];

export const navFor = (role: Role) => NAV_ITEMS.filter((i) => !i.roles || i.roles.includes(role));
