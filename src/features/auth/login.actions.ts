"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { safeLoginRedirect } from "@/lib/login-redirect";

export type LoginActionState = {
  status: "IDLE" | "ERROR";
  message: string | null;
};

export async function loginWithCredentials(
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const callbackUrl = safeLoginRedirect(
    String(formData.get("callbackUrl") || "")
  );

  if (!email || !password) {
    return {
      status: "ERROR",
      message: "Enter your work email and password.",
    };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return {
          status: "ERROR",
          message: "The email or password is incorrect.",
        };
      }

      console.error("Credential sign-in failed:", error.type);
      return {
        status: "ERROR",
        message:
          "Secure sign-in is temporarily unavailable. Please try again or contact your administrator.",
      };
    }

    // Successful Auth.js and Next.js navigations are implemented as framework
    // exceptions and must continue to the framework unchanged.
    throw error;
  }

  return {
    status: "ERROR",
    message: "Secure sign-in did not complete. Please try again.",
  };
}
