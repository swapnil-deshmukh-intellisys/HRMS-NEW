import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

type TokenPayload = {
  userId: number;
  role: string;
  employeeId?: number;
};

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signToken(payload: TokenPayload) {
  // Calculate seconds until 11:59:59 PM today
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  
  const secondsUntilMidnight = Math.max(
    Math.floor((endOfDay.getTime() - now.getTime()) / 1000),
    3600 // Minimum 1 hour if logged in very close to midnight
  );

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: secondsUntilMidnight,
  });
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
