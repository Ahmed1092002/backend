import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

export function validateQuery(schema: ZodType): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({
        error: result.error.issues[0]?.message ?? "Invalid query parameters",
      });
      return;
    }

    res.locals.query = result.data;
    next();
  };
}
