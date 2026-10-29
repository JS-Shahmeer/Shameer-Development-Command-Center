import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof loadCurrentUser>>>;

async function loadCurrentUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, image: true, role: true, title: true, isActive: true },
  });
  return user?.isActive ? user : null;
}

/** The signed-in, active user for this request, or null. Cached per request. */
export const getCurrentUser = cache(loadCurrentUser);

/** For pages: redirects to sign-in when there is no active user. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
