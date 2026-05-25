import { prisma } from "../config/prisma.js";

let cachedClients: any[] | null = null;
let cachedAnnouncements: any[] | null = null;

export const systemCache = {
  async getClients() {
    if (!cachedClients) {
      console.log("[CACHE-MISS] Querying clients registry from DB...");
      cachedClients = await prisma.client.findMany({
        orderBy: { name: "asc" }
      });
    } else {
      console.log("[CACHE-HIT] Serving clients registry from memory.");
    }
    return cachedClients;
  },

  async getAnnouncements() {
    if (!cachedAnnouncements) {
      console.log("[CACHE-MISS] Querying active announcements from DB...");
      cachedAnnouncements = await prisma.announcement.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          createdBy: {
            select: { firstName: true, lastName: true }
          }
        }
      });
    } else {
      console.log("[CACHE-HIT] Serving active announcements from memory.");
    }
    return cachedAnnouncements;
  },

  invalidateClients() {
    console.log("[CACHE-INVALIDATE] Clearing clients cache.");
    cachedClients = null;
  },

  invalidateAnnouncements() {
    console.log("[CACHE-INVALIDATE] Clearing announcements cache.");
    cachedAnnouncements = null;
  }
};
