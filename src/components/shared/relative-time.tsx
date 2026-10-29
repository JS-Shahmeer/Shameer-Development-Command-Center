import { format, formatDistanceToNowStrict } from "date-fns";

export function RelativeTime({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()} title={format(date, "PPpp")} suppressHydrationWarning>
      {formatDistanceToNowStrict(date, { addSuffix: true })}
    </time>
  );
}

export const formatDate = (date: Date | null | undefined) => (date ? format(date, "d MMM yyyy") : "—");
