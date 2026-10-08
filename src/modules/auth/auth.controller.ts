import type { RequestHandler } from "express";
import { register } from "./auth.service.js";
import type { RegisterInput } from "./auth.validation.js";

export const registerUser: RequestHandler = async (req, res) => {
  const user = await register(req.body as RegisterInput);
  res.status(201).json({ data: user });
};
