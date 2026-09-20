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

  google: {
    body: z.object({
      idToken: z.string().min(1),
    }),
  },

  // `refreshToken` e optional: sursa principala e cookie-ul httpOnly, iar
  // body-ul ramane fallback pentru clientii non-browser.
  logout: {
    body: z.object({
      refreshToken: z.string().min(1).optional(),
    }),
  },

  refreshTokens: {
    body: z.object({
      refreshToken: z.string().min(1).optional(),
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
