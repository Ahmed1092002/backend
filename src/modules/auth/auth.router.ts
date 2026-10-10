import { Router } from "express";
import { authenticate } from "../../middleware/authnticate.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { validate } from "../../middleware/validate.js";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
} from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.validation.js";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), asyncHandler(registerUser));
authRouter.post("/login", validate(loginSchema), asyncHandler(loginUser));
authRouter.get("/me", authenticate, asyncHandler(getCurrentUser));
authRouter.post("/refresh", asyncHandler(refreshAccessToken));
authRouter.post("/logout", asyncHandler(logoutUser));
