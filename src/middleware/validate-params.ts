import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { validate } from "./validate.js";

export function validateParams(schema: ZodType): RequestHandler {
  return validate(schema, "params", "Invalid route parameters");
}
