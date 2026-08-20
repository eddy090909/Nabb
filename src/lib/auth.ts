import jwt from "jsonwebtoken";

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const ALLOWED_DOMAIN = "@wesleyan.edu";

export function isWesleyanEmail(email: string): boolean {
  return email.toLowerCase().trim().endsWith(ALLOWED_DOMAIN);
}

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function issueSessionToken(userId: string): string {
  return jwt.sign({ userId }, SECRET, { expiresIn: "30d" });
}

export function verifySessionToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = "seat_tracker_session";
