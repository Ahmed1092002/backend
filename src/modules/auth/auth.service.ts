import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";
import { toUserResponseDto } from "../users/users.mapper.js";
import * as usersRepository from "../users/users.repository.js";
import type { UserResponseDto } from "../users/users.dto.js";
import * as authRepository from "./auth.repository.js";

type RegisterInput = {
  email: string;
  name: string;
  password: string;
};

export type LoginResult = {
  user: UserResponseDto;
  accessToken: string;
  refreshToken: string;
};

function createAccessToken(userId: string, role: string) {
  return jwt.sign({ sub: userId, role }, env.jwtSecret, {
    expiresIn: "15m",
  });
}

function hashRefreshToken(refreshToken: string) {
  return createHash("sha256").update(refreshToken).digest("hex");
}

async function createRefreshSession(userId: string) {
  const session = createRefreshSessionData(userId);

  await authRepository.createRefreshToken(session.data);

  return session.rawToken;
}

function createRefreshSessionData(userId: string) {
  const rawToken = randomBytes(48).toString("hex");

  return {
    rawToken,
    data: {
      tokenHash: hashRefreshToken(rawToken),
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  };
}

export async function register(input: RegisterInput): Promise<UserResponseDto> {
  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const user = await usersRepository.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });

    return toUserResponseDto(user);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(409, "Email already exists");
    }

    throw error;
  }
}
export async function login(
  email: string,
  password: string,
): Promise<LoginResult | null> {
  const user = await usersRepository.findByEmail(email);

  if (!user || !user.passwordHash) {
    return null;
  }
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    return null;
  }

  const refreshToken = await createRefreshSession(user.id);

  return {
    user: toUserResponseDto(user),
    accessToken: createAccessToken(user.id, user.role),
    refreshToken,
  };
}

export async function refresh(refreshToken: string): Promise<LoginResult | null> {
  const tokenHash = hashRefreshToken(refreshToken);
  const storedToken = await authRepository.findRefreshTokenByHash(tokenHash);

  if (!storedToken) {
    return null;
  }

  if (storedToken.expiresAt <= new Date()) {
    await authRepository.deleteRefreshTokenByHash(tokenHash);
    return null;
  }

  // Rotate: exactly one request can consume the old token.
  const nextSession = createRefreshSessionData(storedToken.user.id);
  const wasRotated = await authRepository.rotateRefreshToken(
    tokenHash,
    nextSession.data,
  );

  if (!wasRotated) {
    return null;
  }

  return {
    user: toUserResponseDto(storedToken.user),
    accessToken: createAccessToken(storedToken.user.id, storedToken.user.role),
    refreshToken: nextSession.rawToken,
  };
}

export async function logout(refreshToken: string) {
  await authRepository.deleteRefreshTokenByHash(hashRefreshToken(refreshToken));
}
