import type { RequestHandler } from "express";
import {
  findFailedOutboxEvents,
  replayFailedOutboxEvent,
} from "../../jobs/outbox.service.js";

export const listFailedOutboxEvents: RequestHandler = async (_req, res) => {
  const events = await findFailedOutboxEvents();
  res.status(200).json({ data: events });
};

export const replayOutboxEvent: RequestHandler = async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const replayed = await replayFailedOutboxEvent(id);

  if (!replayed) {
    res.status(404).json({ error: "Failed outbox event not found" });
    return;
  }

  res.status(202).json({ message: "Outbox event queued for replay" });
};
