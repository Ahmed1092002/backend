import { Router } from "express";
import { authenticate } from "../../middleware/authnticate.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { createRateLimiter } from "../../middleware/rate-limit.js";
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

authRouter.post(
  "/register",
  validate(registerSchema),
  asyncHandler(registerUser),
);
authRouter.post(
  "/login",
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 5, // Limit each IP to 5 requests per windowMs
    message:
      "Too many login attempts from this IP, please try again after 15 minutes",
  }),
  validate(loginSchema),
  asyncHandler(loginUser),
);
authRouter.get("/me", authenticate, asyncHandler(getCurrentUser));
authRouter.post("/refresh", asyncHandler(refreshAccessToken));
authRouter.post("/logout", asyncHandler(logoutUser));
