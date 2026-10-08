import type { RequestHandler } from "express";
import { createUser as createUserInService } from "./users.service.js";
import { findUserById, listUsers } from "./users.service.js";
import type { CreateUserInput } from "./users.validation.js";

export const createUser: RequestHandler = async (req, res) => {
  const user = await createUserInService(req.body as CreateUserInput);
  res.status(201).json({ data: user });
};

export const getUsers: RequestHandler = async (_req, res) => {
  res.status(200).json({ data: await listUsers() });
};

export const getUserById: RequestHandler = async (req, res) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const user = await findUserById(id);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.status(200).json({ data: user });
};
