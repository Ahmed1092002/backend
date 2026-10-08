import { Prisma } from "@prisma/client";
import { AppError } from "../../errors/app-error.js";
import type { UserResponseDto } from "./users.dto.js";
import { toUserResponseDto } from "./users.mapper.js";
import * as usersRepository from "./users.repository.js";

type CreateUserInput = {
  email: string;
  name: string;
};

export async function createUser(
  input: CreateUserInput,
): Promise<UserResponseDto> {
  try {
    const user = await usersRepository.create(input);
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

export async function findUserByEmail(
  email: string,
): Promise<UserResponseDto | null> {
  const user = await usersRepository.findByEmail(email);
  return user ? toUserResponseDto(user) : null;
}
