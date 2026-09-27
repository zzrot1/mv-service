import type { Role, User } from "../../../db/schema.js";
import type { SortOrder } from "../../../utils/index.js";

export type SafeUser = Omit<User, "password" | "deletedAt">;

export type ProfileFields = {
  name?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  county?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export type CreateUserInput = ProfileFields & {
  email: string;
  passwordHash?: string | null;
  role?: Role;
  isEmailVerified?: boolean;
};

export type UpdateUserInput = ProfileFields & {
  email?: string;
  role?: Role;
  isEmailVerified?: boolean;
};

export type UpdateProfileInput = ProfileFields;

export type CreateUserRequest = ProfileFields & {
  email: string;
  password: string;
  role?: Role;
};

export type UserSortField = "createdAt" | "email" | "role";

export type PaginationOptions = {
  page?: number; // 1-based
  limit?: number; // default 10
};

export type QueryUsersOptions = PaginationOptions & {
  sortBy?: UserSortField;
  sortOrder?: SortOrder;
};

export interface IUserRepository {
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;

  create(data: CreateUserInput): Promise<User>;
  updateById(id: number, data: UpdateUserInput): Promise<User>;
  updatePasswordById(id: number, passwordHash: string): Promise<User>;

  softDeleteById(id: number): Promise<void>;
  count(filter?: Partial<Pick<User, "role" | "isEmailVerified">>): Promise<number>;

  query(
    filter: Partial<Pick<User, "role" | "isEmailVerified">>,
    options: QueryUsersOptions,
  ): Promise<SafeUser[]>;
}
