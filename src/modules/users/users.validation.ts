import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("email must be valid"),
  name: z.string().trim().min(1, "name must not be empty"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    email: z.string().email("email must be valid").optional(),
    name: z.string().trim().min(1, "name must not be empty").optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "At least one user field must be provided",
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const findUserByEmailSchema = z.object({
  email: z.string().email("email must be valid"),
});

export type FindUserByEmailInput = z.infer<typeof findUserByEmailSchema>;
