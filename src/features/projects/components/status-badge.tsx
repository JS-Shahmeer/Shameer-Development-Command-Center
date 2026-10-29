import type { ProjectStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { projectStatusLabel } from "../schemas";

const tone = {
  PLANNING: "neutral",
  ACTIVE: "primary",
  ON_HOLD: "warning",
  COMPLETED: "success",
} as const;

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={tone[status]}>{projectStatusLabel[status]}</Badge>;
}
