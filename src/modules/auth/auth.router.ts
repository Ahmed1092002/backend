import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
import { validate } from "../../middleware/validate.js";
import { loginUser, registerUser } from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.validation.js";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), asyncHandler(registerUser));
authRouter.post("/login", validate(loginSchema), asyncHandler(loginUser));
