"use server";

import { signIn, signOut } from "@/lib/auth";

export async function signInWithGithub() {
  await signIn("github", { redirectTo: "/dashboard" });
}

export async function signInAsDevUser(formData: FormData) {
  await signIn("dev-login", { email: String(formData.get("email") ?? ""), redirectTo: "/dashboard" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/sign-in" });
}
