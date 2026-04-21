import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { sendSuccess } from "../../utils/api.js";
import { getGoogleAuthUrl, linkGoogleAccount, unlinkGoogleAccount, createMeetLink, syncHolidaysToGoogleCalendar } from "./service.js";

const router = Router();

/**
 * GET /api/google/auth-url
 * Returns the URL to redirect the user to Google for consent
 */
router.get("/auth-url", authenticate, async (_req, res, next) => {
  try {
    const url = getGoogleAuthUrl();
    return sendSuccess(res, "Auth URL generated", { url });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/google/callback
 * Exchanges the code for tokens and links the account
 */
router.post("/callback", authenticate, async (req, res, next) => {
  try {
    const { code } = req.body;
    const result = await linkGoogleAccount(req.user!.id, code);
    return sendSuccess(res, "Google account linked successfully", result);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/google/unlink
 * Unlinks the Google account
 */
router.delete("/unlink", authenticate, async (req, res, next) => {
  try {
    const result = await unlinkGoogleAccount(req.user!.id);
    return sendSuccess(res, "Google account unlinked successfully", result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/google/instant-meet
 * Generates an instant Google Meet link
 */
router.post("/instant-meet", authenticate, async (req, res, next) => {
  try {
    const { summary } = req.body;
    const result = await createMeetLink(req.user!.id, summary);
    return sendSuccess(res, "Google Meet link generated", result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/google/sync-holidays
 * Syncs future holidays to the user's Google Calendar
 */
router.post("/sync-holidays", authenticate, async (req, res, next) => {
  try {
    const result = await syncHolidaysToGoogleCalendar(req.user!.id);
    return sendSuccess(res, "Holidays synced successfully", result);
  } catch (error) {
    next(error);
  }
});

export default router;
