import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

type ValidationSource = "body" | "query" | "params";

const fallbackErrors: Record<ValidationSource, string> = {
  body: "Invalid request body",
  query: "Invalid query parameters",
  params: "Invalid route parameters",
};

export function validate(
  schema: ZodType,
  source: ValidationSource = "body",
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      res.status(400).json({
        error: result.error.issues[0]?.message ?? fallbackErrors[source],
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
