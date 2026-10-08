import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { validate } from "./validate.js";

export function validateBody(schema: ZodType): RequestHandler {
  return validate(schema, "body", "Invalid request body");
}
