import { z } from "zod";

/** Sters explicit cu null, lasat neatins daca lipseste din body. */
const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional();

/** Reutilizat si de userValidation.updateUser, pentru editarea de catre admin. */
export const profileFieldsShape = {
  name: optionalText(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ().-]{6,20}$/, "Invalid phone number")
    .nullable()
    .optional(),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(100),
  county: optionalText(100),
  postalCode: optionalText(20),
  // ISO 3166-1 alpha-2, ex: RO, DE
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Za-z]{2}$/, "Country must be an ISO 3166-1 alpha-2 code")
    .nullable()
    .optional(),
} as const;

export const atLeastOneField = {
  message: "At least one field must be provided",
} as const;

export const profileValidation = {
  updateProfile: {
    body: z
      .object(profileFieldsShape)
      .refine((obj) => Object.keys(obj).length > 0, atLeastOneField),
  },
} as const;
