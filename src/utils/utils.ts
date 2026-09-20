import { z } from "zod";
export type SortOrder = "asc" | "desc";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
};
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export type OAuthProfile = {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name?: string | null;
};

export interface OAuthProvider {
  verify(credential: string): Promise<OAuthProfile>;
}

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * Exclude keys from object
 * @param obj
 * @param keys
 * @returns
 */
export const exclude = <Type, Key extends keyof Type>(
  obj: Type,
  keys: Key[],
): Omit<Type, Key> => {
  for (const key of keys) {
    delete obj[key];
  }
  return obj;
};

export const pick = (obj: object, keys: string[]) => {
  return keys.reduce<{ [key: string]: unknown }>((finalObj, key) => {
    if (obj && Object.hasOwnProperty.call(obj, key)) {
      finalObj[key] = obj[key as keyof typeof obj];
    }
    return finalObj;
  }, {});
};
