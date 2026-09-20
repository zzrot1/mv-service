import { z } from "zod";
import { roleValues } from "../db/schema.js";
import { passwordSchema } from "../utils/utils.js";
import { atLeastOneField, profileFieldsShape } from "./profile.js";

const emailSchema = z.email();

const userIdParam = z.object({
  userId: z.coerce.number().int().positive(),
});

export const userValidation = {
  createUser: {
    body: z.object({
      ...profileFieldsShape,
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
    // adminul poate edita si campurile de profil, plus email/parola/rol
    body: z
      .object({
        ...profileFieldsShape,
        email: emailSchema.optional(),
        password: passwordSchema.optional(),
        role: z.enum(roleValues).optional(),
      })
      .refine((obj) => Object.keys(obj).length > 0, atLeastOneField),
  },

  deleteUser: {
    params: userIdParam,
  },
} as const;
