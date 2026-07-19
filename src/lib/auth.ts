import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Okta from "next-auth/providers/okta";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },

      async authorize(credentials) {
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");

        const user = await prisma.user.findUnique({
          where: { email },
          include: { organization: { include: { identityProviders: true } } },
        });

        if (!user || !user.password || !user.isActive || user.organization?.status === "SUSPENDED") return null;
        if (user.organization?.identityProviders.some((provider) => provider.isEnabled && provider.enforceSso)) return null;

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
    ...(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
      ? [MicrosoftEntraID({ clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID, clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET, issuer: "https://login.microsoftonline.com/organizations/v2.0" })]
      : []),
    ...(process.env.AUTH_OKTA_ID && process.env.AUTH_OKTA_SECRET && process.env.AUTH_OKTA_ISSUER
      ? [Okta({ clientId: process.env.AUTH_OKTA_ID, clientSecret: process.env.AUTH_OKTA_SECRET, issuer: process.env.AUTH_OKTA_ISSUER })]
      : []),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "credentials") return true;
      const email = user.email?.trim().toLowerCase();
      if (!email) return false;
      const internal = await prisma.user.findUnique({ where: { email }, include: { organization: { include: { identityProviders: true } } } });
      if (!internal?.isActive || internal.organization?.status !== "ACTIVE") return false;
      const providerType = account?.provider === "microsoft-entra-id" ? "MICROSOFT_ENTRA" : account?.provider === "okta" ? "OKTA" : null;
      if (!providerType) return false;
      const issuer = String(profile?.iss || "").replace(/\/$/, "");
      const directoryId = String((profile as Record<string, unknown> | undefined)?.tid || "");
      return internal.organization.identityProviders.some((configuration) => configuration.isEnabled && configuration.type === providerType && (providerType === "MICROSOFT_ENTRA" ? configuration.directoryId === directoryId : configuration.issuer.replace(/\/$/, "") === issuer));
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
      }

      return session;
    },
  },
});
