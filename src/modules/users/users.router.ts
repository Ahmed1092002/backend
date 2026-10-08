import { Router } from "express";
import { validateBody } from "../../middleware/validate-body.js";
import { validateParams } from "../../middleware/validate-params.js";
import {
  createUser,
  getUserByEmail,
  getUserById,
  getUsers,
  updateUser,
} from "./users.controller.js";
import {
  createUserSchema,
  findUserByEmailSchema,
  updateUserSchema,
} from "./users.validation.js";

export const usersRouter = Router();

usersRouter.get("/", getUsers);
usersRouter.get("/email/:email", validateParams(findUserByEmailSchema), getUserByEmail);
usersRouter.get("/:id", getUserById);
usersRouter.post("/", validateBody(createUserSchema), createUser);
usersRouter.patch("/:id", validateBody(updateUserSchema), updateUser);

