import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      checks: ["state"],
    }),
  ],
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, profile }) {
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
