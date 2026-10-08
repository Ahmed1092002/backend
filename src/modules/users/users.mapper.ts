import type { User as PrismaUser } from "@prisma/client";
import type { UserResponseDto } from "./users.dto.js";

export function toUserResponseDto(user: PrismaUser): UserResponseDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}
