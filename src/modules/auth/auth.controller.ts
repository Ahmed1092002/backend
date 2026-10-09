import type { RequestHandler } from "express";
import { refreshCookieOptions } from "./auth.cookies.js";
import { login, logout, refresh, register } from "./auth.service.js";
import type { LoginInput, RegisterInput } from "./auth.validation.js";

export const registerUser: RequestHandler = async (req, res) => {
  const user = await register(req.body as RegisterInput);
  res.status(201).json({ data: user });
};
export const loginUser: RequestHandler = async (req, res) => {
  const { email, password } = req.body as LoginInput;
  const loginResult = await login(email, password);
  if (!loginResult) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  res.cookie("refreshToken", loginResult.refreshToken, refreshCookieOptions);

  res.status(200).json({
    message: "Login successful",
    data: {
      user: loginResult.user,
      accessToken: loginResult.accessToken,
    },
  });
};

export const refreshAccessToken: RequestHandler = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (typeof refreshToken !== "string") {
    res.status(401).json({ error: "Refresh token missing" });
    return;
  }

  const refreshResult = await refresh(refreshToken);

  if (!refreshResult) {
    res.clearCookie("refreshToken", refreshCookieOptions);
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  res.cookie("refreshToken", refreshResult.refreshToken, refreshCookieOptions);
  res.status(200).json({
    data: {
      user: refreshResult.user,
      accessToken: refreshResult.accessToken,
    },
  });
};

export const logoutUser: RequestHandler = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (typeof refreshToken === "string") {
    await logout(refreshToken);
  }

  res.clearCookie("refreshToken", refreshCookieOptions);
  res.status(204).send();
};
