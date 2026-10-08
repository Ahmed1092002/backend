import type { RequestHandler } from "express";
import {
  createUser as createUserInService,
  deleteUserById,
  findUserByEmail as findUserByEmailInService,
  findUserById,
  listUsers,
  updateUserById,
} from "./users.service.js";
import type {
  CreateUserInput,
  FindUserByEmailInput,
  UpdateUserInput,
} from "./users.validation.js";

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

export const getUserByEmail: RequestHandler = async (_req, res) => {
  const { email } = res.locals.params as FindUserByEmailInput;
  const user = await findUserByEmailInService(email);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.status(200).json({ data: user });
};

export const updateUser: RequestHandler = async (req, res) => {
  const { id } = req.params;

  if (typeof id !== "string") {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const user = await updateUserById(id, req.body as UpdateUserInput);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.status(200).json({ data: user });
};

export const deleteUser: RequestHandler = async (req, res) => {
  const { id } = req.params;

  if (typeof id !== "string" || !(await deleteUserById(id))) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.status(204).send();
};
