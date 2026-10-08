import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

export function validateParams(schema: ZodType): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      res.status(400).json({
        error: result.error.issues[0]?.message ?? "Invalid route parameters",
      });
      return;
    }

    res.locals.params = result.data;
    next();
  };
}
