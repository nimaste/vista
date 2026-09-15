import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";
import { prisma } from "./db";
import { hashToken } from "./tokens";

const SESSION_COOKIE = "vista_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

let secretKeyPromise: Promise<Uint8Array> | null = null;
const secretKey = (): Promise<Uint8Array> => {
  if (!secretKeyPromise) {
    secretKeyPromise = Promise.resolve(new TextEncoder().encode(env.JWT_SECRET));
  }
  return secretKeyPromise;
};

export type CurrentUser = {
  id: string;
  email: string;
  username: string;
  role: "ADMIN" | "USER";
};

export const signSession = async (userId: string): Promise<string> => {
  const key = await secretKey();
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(key);
};

export const verifySession = async (token: string): Promise<string | null> => {
  try {
    const key = await secretKey();
    const { payload } = await jwtVerify(token, key);
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
};

export const setSessionCookie = (token: string) => {
  const secure = env.COOKIE_SECURE ?? env.PUBLIC_WEB_URL.startsWith("https://");
  cookies().set({
    name: SESSION_COOKIE,
    value: token,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
};

export const clearSessionCookie = () => {
  cookies().set({
    name: SESSION_COOKIE,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
  });
};

export const getCurrentUser = async (): Promise<CurrentUser | null> => {
  // Bearer token path — used by mobile / TV clients.
  const auth = headers().get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const raw = auth.slice(7).trim();
    if (raw) {
      const tokenHash = hashToken(raw);
      const row = await prisma.apiToken.findUnique({
        where: { tokenHash },
        include: {
          user: { select: { id: true, email: true, username: true, role: true } },
        },
      });
      if (row && (!row.expiresAt || row.expiresAt > new Date())) {
        // Update lastUsedAt opportunistically (fire-and-forget).
        prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
        return row.user as CurrentUser;
      }
    }
  }

  // Cookie session — used by the browser.
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = await verifySession(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, role: true },
  });
  return (user as CurrentUser) ?? null;
};

export const getAuthStatus = async (): Promise<{ firstRun: boolean; userCount: number }> => {
  const userCount = await prisma.user.count();
  return { firstRun: userCount === 0, userCount };
};

export const requireUser = async (): Promise<CurrentUser> => {
  const user = await getCurrentUser();
  if (user) return user;
  const status = await getAuthStatus();
  redirect(status.firstRun ? "/setup" : "/login");
};

/** For route handlers — returns the user or null (not a redirect). */
export const requireUserForRoute = async (): Promise<CurrentUser | null> => {
  return getCurrentUser();
};

export const requireAdminForRoute = async (): Promise<CurrentUser | null> => {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
};
