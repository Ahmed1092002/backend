import { Router } from "express";
import { authenticate } from "../../middleware/authnticate.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requireRole } from "../../middleware/requireRole.js";
import { validate } from "../../middleware/validate.js";
import {
  createUser,
  deleteUser,
  getUserByEmail,
  getUserById,
  getUsers,
  updateUser,
  updateUserRole,
} from "./users.controller.js";
import {
  createUserSchema,
  findUserByEmailSchema,
  updateUserSchema,
  updateUserRoleSchema,
} from "./users.validation.js";

export const usersRouter = Router();

usersRouter.get("/", authenticate, asyncHandler(getUsers));
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
usersRouter.patch(
  "/:id/role",
  authenticate,
  requireRole("ADMIN"),
  validate(updateUserRoleSchema),
  asyncHandler(updateUserRole),
);
usersRouter.delete(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  asyncHandler(deleteUser),
);

