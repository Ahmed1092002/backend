import { Router } from "express";
import { authenticate } from "../../middleware/authnticate.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import {
  listFailedOutboxEvents,
  replayOutboxEvent,
} from "./outbox.controller.js";
import { outboxEventIdParamsSchema } from "./outbox.validation.js";

export const outboxRouter = Router();

// These are operations endpoints, intentionally restricted to administrators.
outboxRouter.get(
  "/failed",
  authenticate,
  requireRole("ADMIN"),
  asyncHandler(listFailedOutboxEvents),
);
outboxRouter.post(
  "/:id/replay",
  authenticate,
  requireRole("ADMIN"),
  validate(outboxEventIdParamsSchema, "params"),
  asyncHandler(replayOutboxEvent),
);
