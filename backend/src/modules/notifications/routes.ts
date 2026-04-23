import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { sendSuccess } from "../../utils/api.js";
import { env } from "../../config/env.js";
import { saveSubscription } from "./service.js";

const router = Router();

const subscribeSchema = z.object({
  subscription: z.any()
});

router.use(authenticate);

// Get the public key so frontend can encrypt its subscription
router.get("/vapid-public-key", (req, res) => {
  return sendSuccess(res, "Public key fetched", { publicKey: env.VAPID_PUBLIC_KEY });
});

// Save a new subscription for the logged in user
router.post("/subscribe", validate(subscribeSchema), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const subscription = await saveSubscription(userId, req.body.subscription);
    return sendSuccess(res, "Subscribed successfully", subscription, 201);
  } catch (error) {
    next(error);
  }
});

export default router;
