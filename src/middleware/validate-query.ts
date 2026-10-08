import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { validate } from "./validate.js";

export function validateQuery(schema: ZodType): RequestHandler {
  return validate(schema, "query", "Invalid query parameters");
}
