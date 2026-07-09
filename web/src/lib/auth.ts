import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { randomUUID } from "crypto";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      id: "guest",
      name: "Guest",
      credentials: {},
      authorize() {
        const id = randomUUID();
        return {
          id,
          email: `guest-${id}@cardparser.guest`,
          name: "Guest",
        };
      },
    }),
  ],
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user, profile }) {
      if (user?.email) {
        token.email = user.email;
        token.name = user.name;
        token.picture = (user as Record<string, unknown>).image as string | undefined;
      }
      if (profile?.email) {
        token.email = profile.email;
        token.name = profile.name;
        token.picture = profile.picture as string | undefined;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email;
        session.user.name = token.name;
        session.user.image = token.picture as string | undefined;
      }
      return session;
    },
  },
});
