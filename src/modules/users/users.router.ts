import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
import { validate } from "../../middleware/validate.js";
import {
  createUser,
  deleteUser,
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

usersRouter.get("/", asyncHandler(getUsers));
usersRouter.get(
  "/email/:email",
  validate(findUserByEmailSchema, "params"),
  asyncHandler(getUserByEmail),
);
usersRouter.get("/:id", asyncHandler(getUserById));
usersRouter.post("/", validate(createUserSchema), asyncHandler(createUser));
usersRouter.patch(
  "/:id",
  validate(updateUserSchema),
  asyncHandler(updateUser),
);
usersRouter.delete("/:id", asyncHandler(deleteUser));

