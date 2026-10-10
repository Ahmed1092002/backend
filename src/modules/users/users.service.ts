import { Prisma, UserRole } from "@prisma/client";
import { AppError } from "../../errors/app-error.js";
import type { UserResponseDto } from "./users.dto.js";
import { toUserResponseDto } from "./users.mapper.js";
import * as usersRepository from "./users.repository.js";

type CreateUserInput = {
  email: string;
  name: string;
};

type UpdateUserInput = {
  email?: string | undefined;
  name?: string | undefined;
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

export async function listUsers(): Promise<UserResponseDto[]> {
  const users = await usersRepository.findAll();
  return users.map(toUserResponseDto);
}

export async function findUserById(
  id: string,
): Promise<UserResponseDto | undefined> {
  const user = await usersRepository.findById(id);
  return user ? toUserResponseDto(user) : undefined;
}

export async function findUserByEmail(
  email: string,
): Promise<UserResponseDto | null> {
  const user = await usersRepository.findByEmail(email);
  return user ? toUserResponseDto(user) : null;
}

export async function updateUserById(
  id: string,
  input: UpdateUserInput,
): Promise<UserResponseDto | undefined> {
  const existingUser = await usersRepository.findById(id);

  if (!existingUser) {
    return undefined;
  }

  const data = {
    ...(input.email === undefined ? {} : { email: input.email }),
    ...(input.name === undefined ? {} : { name: input.name }),
  };

  try {
    const user = await usersRepository.updateById(id, data);
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

export async function updateUserRoleById(
  id: string,
  role: UserRole,
): Promise<{ id: string; role: UserRole } | undefined> {
  const existingUser = await usersRepository.findById(id);

  if (!existingUser) {
    return undefined;
  }

  const user = await usersRepository.updateRoleById(id, role);
  return { id: user.id, role: user.role };
}

export async function deleteUserById(
  id: string,
): Promise<UserResponseDto | undefined> {
  const existingUser = await usersRepository.findById(id);

  if (!existingUser) {
    return undefined;
  }

  const user = await usersRepository.deleteById(id);
  return toUserResponseDto(user);
}
