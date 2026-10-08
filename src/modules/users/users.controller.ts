import type { RequestHandler } from "express";
import { createUser as createUserInService } from "./users.service.js";
import type { CreateUserInput } from "./users.validation.js";

export const createUser: RequestHandler = async (req, res) => {
  const user = await createUserInService(req.body as CreateUserInput);
  res.status(201).json({ data: user });
};
