import type { Role, User } from "../../../db/schema.js";
import { SortOrder } from "../../../utils/index.js";

export type SafeUser = Omit<User, "password">;

export type CreateUserInput = {
  email: string;
  name?: string | null;
  passwordHash: string;
  role?: Role;
  isEmailVerified?: boolean;
};

export type UpdateUserInput = {
  email?: string;
  name?: string | null;
  role?: Role;
  isEmailVerified?: boolean;
};

export type CreateUserRequest = {
  email: string;
  password: string;
  name?: string;
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

  deleteById(id: number): Promise<void>;
  count(filter?: Partial<Pick<User, "role" | "isEmailVerified">>): Promise<number>;

  query(
    filter: Partial<Pick<User, "role" | "isEmailVerified">>,
    options: QueryUsersOptions,
  ): Promise<SafeUser[]>;
}
