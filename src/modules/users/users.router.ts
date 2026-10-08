import { Router } from "express";
import { validate } from "../../middleware/validate.js";
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
usersRouter.get(
  "/email/:email",
  validate(findUserByEmailSchema, "params"),
  getUserByEmail,
);
usersRouter.get("/:id", getUserById);
usersRouter.post("/", validate(createUserSchema), createUser);
usersRouter.patch("/:id", validate(updateUserSchema), updateUser);

