import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "leadflow_session";

export function authEnabled() {
  return Boolean(process.env.AUTH_USERNAME && process.env.AUTH_PASSWORD && process.env.AUTH_SECRET);
}

function signature(payload: string) {
  return createHmac("sha256", process.env.AUTH_SECRET!).update(payload).digest("base64url");
}

function secureEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function validCredentials(username: string, password: string) {
  return authEnabled() && secureEqual(username, process.env.AUTH_USERNAME!) && secureEqual(password, process.env.AUTH_PASSWORD!);
}

export async function isAuthorized() {
  if (!authEnabled()) return true;
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return false;
  const [payload, providedSignature] = token.split(".");
  if (!payload || !providedSignature || !secureEqual(signature(payload), providedSignature)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.username === process.env.AUTH_USERNAME && typeof data.expires === "number" && data.expires > Date.now();
  } catch {
    return false;
  }
}

export async function setSession(username: string, secure: boolean) {
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ username, expires })).toString("base64url");
  (await cookies()).set(cookieName, `${payload}.${signature(payload)}`, { httpOnly: true, sameSite: "lax", secure, path: "/", expires: new Date(expires) });
}

export async function clearSession() {
  (await cookies()).delete(cookieName);
}
