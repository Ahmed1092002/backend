import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { registerUser } from "./auth.controller.js";
import { registerSchema } from "./auth.validation.js";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), registerUser);
