import { cn, initials } from "@/lib/utils";

export function Avatar({
  user,
  className,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
  className?: string;
}) {
  const label = user.name || user.email || "User";
  return user.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.image} alt={label} className={cn("size-7 rounded-full object-cover", className)} />
  ) : (
    <span
      aria-label={label}
      className={cn(
        "bg-primary/15 text-primary inline-flex size-7 items-center justify-center rounded-full text-[11px] font-semibold",
        className,
      )}
    >
      {initials(user.name, user.email)}
    </span>
  );
}
