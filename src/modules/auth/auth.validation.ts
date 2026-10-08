import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("email must be valid"),
  name: z.string().trim().min(1, "name must not be empty"),
  password: z.string().min(8, "password must be at least 8 characters"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email("email must be valid"),
  password: z.string().min(8, "password must be at least 8 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
