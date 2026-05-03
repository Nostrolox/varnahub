import crypto from "node:crypto";
import { config } from "./config.js";

const COOKIE_NAME = "varna_parking_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

function sign(value) {
  return crypto
    .createHmac("sha256", config.sessionSecret)
    .update(value)
    .digest("base64url");
}

function parseCookies(header = "") {
  return header.split(";").reduce((cookies, part) => {
    const index = part.indexOf("=");
    if (index === -1) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function serializeCookie(value) {
  const secure = config.isProduction ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(
    value,
  )}; HttpOnly; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

function readSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;

  const [userId, signature] = raw.split(".");
  if (!userId || !signature) return null;
  const expected = sign(userId);

  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  return { id: userId };
}

export function getOrCreateSession(req, res) {
  const existing = readSession(req);
  if (existing) return existing;

  const user = { id: crypto.randomUUID() };
  const value = `${user.id}.${sign(user.id)}`;
  res.setHeader("Set-Cookie", serializeCookie(value));
  return user;
}

export function requireSession(req, res, next) {
  req.user = getOrCreateSession(req, res);
  next();
}

export function publicUser(user) {
  return {
    id: user.id,
    label: `Driver ${user.id.slice(0, 8)}`,
  };
}
