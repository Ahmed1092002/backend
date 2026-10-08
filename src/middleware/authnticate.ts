import type { NextFunction, Response, Request } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  const token = authHeader.split(" ")[1];
  const barerToken = authHeader.split(" ")[0];
  if (barerToken !== "Bearer") {
    return res
      .status(401)
      .json({ error: "Invalid authorization header format" });
  }
  if (!token) {
    return res.status(401).json({ error: "Token missing" });
  }
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
