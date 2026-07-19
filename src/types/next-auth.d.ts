import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      sessionValid: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    sessionVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    sessionVersion?: number;
    sessionValid?: boolean;
  }
}
