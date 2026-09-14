import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Defaults aligned with OWASP. Argon2id is the library default — no need to set it explicitly.
const OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export const hashPassword = (plain: string): Promise<string> => hash(plain, OPTS);

export const verifyPassword = async (hashed: string, plain: string): Promise<boolean> => {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
};
