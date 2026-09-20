import { z } from "zod";
import { passwordSchema } from "../utils/index.js";

export const authValidation = {
  register: {
    body: z.object({
      email: z.email(),
      password: passwordSchema,
    }),
  },

  login: {
    body: z.object({
      email: z.email(),
      password: z.string().min(1),
    }),
  },

  logout: {
    body: z.object({
      refreshToken: z.string().min(1),
    }),
  },

  refreshTokens: {
    body: z.object({
      refreshToken: z.string().min(1),
    }),
  },

  forgotPassword: {
    body: z.object({
      email: z.email(),
    }),
  },

  resetPassword: {
    query: z.object({
      token: z.string().min(1),
    }),
    body: z.object({
      password: passwordSchema,
    }),
  },

  verifyEmail: {
    query: z.object({
      token: z.string().min(1),
    }),
  },
} as const;
