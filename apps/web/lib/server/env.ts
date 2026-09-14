import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  DATABASE_URL: z.string().default("file:/data/vista.db"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  PUBLIC_WEB_URL: z.string().url().default("http://localhost:3456"),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => {
      if (v == null || v === "") return undefined;
      if (v === "true" || v === "1") return true;
      if (v === "false" || v === "0") return false;
      throw new Error(`COOKIE_SECURE must be 'true' or 'false', got '${v}'`);
    }),
});

type Env = z.infer<typeof schema>;

let cached: Env | null = null;

const resolve = (): Env => {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("[env] invalid:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  cached = parsed.data;
  return cached;
};

// Proxy so env.X is only validated at actual property access, never at import.
// This lets Next's build-time page collection run without requiring runtime env vars.
export const env = new Proxy({} as Env, {
  get(_target, prop) {
    return resolve()[prop as keyof Env];
  },
});

export type { Env };
