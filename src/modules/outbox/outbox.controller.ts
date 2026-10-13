import type { RequestHandler } from "express";
import {
  findOutboxEventDetails,
  findFailedOutboxEvents,
  replayFailedOutboxEvent,
} from "../../jobs/outbox.service.js";

export const listFailedOutboxEvents: RequestHandler = async (_req, res) => {
  const events = await findFailedOutboxEvents();
  res.status(200).json({ data: events });
};

export const getOutboxEvent: RequestHandler = async (_req, res) => {
  const { id } = res.locals.params as { id: string };
  const event = await findOutboxEventDetails(id);

  if (!event) {
    res.status(404).json({ error: "Outbox event not found" });
    return;
  }

  res.status(200).json({ data: event });
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
