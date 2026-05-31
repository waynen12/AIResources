import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/db';

declare module 'next-auth' {
  interface User {
    username: string;
    role: 'admin' | 'contributor';
  }
  interface Session {
    user: {
      id: string;
      username: string;
      role: 'admin' | 'contributor';
    } & DefaultSession['user'];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: {},
        password: {},
      },
      authorize: async (credentials) => {
        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!username || !password) return null;

        const db = getDb();
        const account = db.prepare(
          `SELECT id, username, password_hash, role FROM accounts WHERE username = ? AND is_active = 1`
        ).get(username) as { id: number; username: string; password_hash: string; role: string } | undefined;

        if (!account) return null;

        const valid = await bcrypt.compare(password, account.password_hash);
        if (!valid) return null;

        return {
          id: String(account.id),
          username: account.username,
          role: account.role as 'admin' | 'contributor',
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.accountId = Number(user.id);
        token.username = (user as { username: string }).username;
        token.role = (user as { role: string }).role as 'admin' | 'contributor';
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.accountId as number);
      session.user.username = token.username as string;
      session.user.role = token.role as 'admin' | 'contributor';
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 604800,
    updateAge: 86400,
  },
  pages: {
    signIn: '/login',
  },
});
