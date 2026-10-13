import { z } from "zod";

export const outboxEventIdParamsSchema = z.object({
  id: z.string().uuid("Outbox event id must be a UUID"),
});
