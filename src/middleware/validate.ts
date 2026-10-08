import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

type ValidationSource = "body" | "query" | "params";

export function validate(
  schema: ZodType,
  source: ValidationSource,
  fallbackError: string,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      res.status(400).json({
        error: result.error.issues[0]?.message ?? fallbackError,
      });
      return;
    }

    if (source === "body") {
      req.body = result.data;
    } else {
      res.locals[source] = result.data;
    }

    next();
  };
}
