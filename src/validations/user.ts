import { z } from "zod";
import { roleValues } from "../db/schema.js";
import { passwordSchema } from "../utils/utils.js";

const emailSchema = z.email();

const userIdParam = z.object({
  userId: z.coerce.number().int().positive(),
});

export const userValidation = {
  createUser: {
    body: z.object({
      email: emailSchema,
      password: passwordSchema,
      name: z.string().min(1, "Name is required"),
      role: z.enum(roleValues),
    }),
  },

  getUsers: {
    query: z.object({
      name: z.string().min(1).optional(),
      role: z.enum(roleValues).optional(),
      sortBy: z.string().optional(),
      limit: z.coerce.number().int().positive().optional(),
      page: z.coerce.number().int().positive().optional(),
    }),
  },

  getUser: {
    params: userIdParam,
  },

  updateUser: {
    params: userIdParam,
    body: z
      .object({
        email: emailSchema.optional(),
        password: passwordSchema.optional(),
        name: z.string().min(1).optional(),
        role: z.enum(roleValues).optional(),
      })
      .refine((obj) => Object.keys(obj).length > 0, {
        message: "At least one field must be provided",
      }),
  },

  deleteUser: {
    params: userIdParam,
  },
} as const;
