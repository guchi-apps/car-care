import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Passkey from "next-auth/providers/passkey";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { applyTokenToSession, authConfig } from "@/auth.config";
import { applyAuthUrlEnv } from "@/lib/auth-url";
import { notifySignalyLogin } from "@/lib/signaly";
import { prisma } from "@/lib/prisma";

applyAuthUrlEnv();

let skipNextPasskeyLoginNotification = false;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  experimental: { enableWebAuthn: true },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, ...rest }) {
      const nextToken = await authConfig.callbacks.jwt({ token, user, ...rest });

      if (user) {
        return nextToken;
      }

      const userId = nextToken.id ?? nextToken.sub;
      if (!userId) {
        return nextToken;
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: userId as string },
        select: { id: true },
      });
      if (!dbUser) {
        // DB リセットや DB 切替後に古い JWT が残っている場合は再ログインさせる
        return {};
      }

      return nextToken;
    },
    session({ session, token }) {
      const nextSession = applyTokenToSession(session, token);
      if (!token.id) {
        return { expires: nextSession.expires };
      }
      return nextSession;
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: false,
    }),
    Passkey({
      formFields: {
        email: {
          label: "Email",
          type: "email",
          required: true,
          autocomplete: "username webauthn",
        },
      },
    }),
  ],
  events: {
    linkAccount({ account }) {
      if (account.provider === "passkey") {
        skipNextPasskeyLoginNotification = true;
      }
    },
    async signIn({ user, account }) {
      if (user.email) {
        if (
          account?.provider === "passkey" &&
          skipNextPasskeyLoginNotification
        ) {
          skipNextPasskeyLoginNotification = false;
          return;
        }

        await notifySignalyLogin({
          email: user.email,
          name: user.name,
          provider: account?.provider,
        });
      }
    },
  },
});
