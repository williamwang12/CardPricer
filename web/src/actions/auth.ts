"use server";

import { signIn, signOut } from "@/lib/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/inventory" });
}

export async function signInWithFacebook() {
  await signIn("facebook", { redirectTo: "/inventory" });
}

export async function signInAsGuest() {
  await signIn("guest", { redirectTo: "/inventory" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
