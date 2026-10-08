import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("email must be valid"),
  name: z.string().trim().min(1, "name must not be empty"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;



export const findUserByEmailSchema = z.object({
  email: z.string().email("email must be valid"),
});

export type FindUserByEmailInput = z.infer<typeof findUserByEmailSchema>;