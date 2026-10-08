import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AppError } from "../../errors/app-error.js";
import { toUserResponseDto } from "../users/users.mapper.js";
import * as usersRepository from "../users/users.repository.js";
import type { UserResponseDto } from "../users/users.dto.js";

type RegisterInput = {
  email: string;
  name: string;
  password: string;
};

export async function register(
  input: RegisterInput,
): Promise<UserResponseDto> {
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
