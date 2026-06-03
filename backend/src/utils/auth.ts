import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { env } from "../config/env.js";
import { TIMEZONE } from "./dates.js";

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
  const now = new Date();
  
  // Calculate upcoming 8:00 AM in the Asia/Kolkata timezone
  const nowInIst = toZonedTime(now, TIMEZONE);
  const targetInIst = new Date(nowInIst);
  targetInIst.setHours(8, 0, 0, 0);
  
  // If it's already past 8:00 AM IST today, set target to tomorrow at 8:00 AM IST
  if (nowInIst.getTime() >= targetInIst.getTime()) {
    targetInIst.setDate(targetInIst.getDate() + 1);
  }
  
  // Early morning buffer: if login happens within 2 hours before 8:00 AM IST (i.e. after 6:00 AM),
  // push expiration to the following day's 8:00 AM IST.
  if (targetInIst.getTime() - nowInIst.getTime() < 2 * 60 * 60 * 1000) {
    targetInIst.setDate(targetInIst.getDate() + 1);
  }
  
  // Convert target back to a standard UTC Date to find the exact duration in seconds
  const targetUtc = fromZonedTime(targetInIst, TIMEZONE);
  const secondsUntilExpiry = Math.max(
    Math.floor((targetUtc.getTime() - now.getTime()) / 1000),
    3600 // Minimum 1 hour safety backup
  );

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: secondsUntilExpiry,
  });
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
