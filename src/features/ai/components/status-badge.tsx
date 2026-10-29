import type { BreakdownStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const tone = { DRAFT: "warning", APPROVED: "success", DISCARDED: "neutral" } as const;
const label = { DRAFT: "Draft", APPROVED: "Approved", DISCARDED: "Discarded" } as const;

export function BreakdownStatusBadge({ status }: { status: BreakdownStatus }) {
  return <Badge tone={tone[status]}>{label[status]}</Badge>;
}
