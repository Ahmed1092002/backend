import type { RequestHandler } from "express";
import { login, register } from "./auth.service.js";
import type { LoginInput, RegisterInput } from "./auth.validation.js";

export const registerUser: RequestHandler = async (req, res) => {
  const user = await register(req.body as RegisterInput);
  res.status(201).json({ data: user });
};
export const loginUser: RequestHandler = async (req, res) => {
  const { email, password } = req.body as LoginInput;
  const user = await login(email, password);
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  res.status(200).json({ message: "Login successful", data: user });
};
