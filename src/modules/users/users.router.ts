import { Router } from "express";
import { validateBody } from "../../middleware/validate-body.js";
import {
  createUser,
  getUserById,
  getUsers,
} from "./users.controller.js";
import { createUserSchema, findUserByEmailSchema } from "./users.validation.js";
import { findUserByEmail } from "./users.service.js";

export const usersRouter = Router();

usersRouter.get("/", getUsers);
usersRouter.get("/:id", getUserById);
usersRouter.post("/", validateBody(createUserSchema), createUser);
usersRouter.get("/email/:email", validateBody(findUserByEmailSchema), findUserByEmail);

