import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "../../config/dependencyTokens.js";
import type { Role } from "../../db/schema.js";
import type { BaseCrudService } from "../../toolkit/index.js";
import type {
  NormalizedPagedQuery,
  NormalizedSearchablePagedQuery,
  PagedResult,
} from "../../toolkit/index.js";
import {
  CreateUserRequest,
  IUserRepository,
  SafeUser,
  UpdateUserInput,
  UserSortField,
} from "../repositories/index.js";
import { StatusCodes } from "http-status-codes";
import { ApiError, encryptPassword } from "../../utils/index.js";

const allowedSortFields: ReadonlySet<UserSortField> = new Set([
  "createdAt",
  "email",
  "role",
]);

@injectable()
export class UserService
  implements BaseCrudService<SafeUser, CreateUserRequest, UpdateUserInput>
{
  constructor(
    @inject(DI_TOKENS.UserRepository)
    private readonly users: IUserRepository,
  ) {}

  async create(params: CreateUserRequest): Promise<SafeUser> {
    const existing = await this.users.findByEmail(params.email);
    if (existing)
      throw new ApiError(StatusCodes.BAD_REQUEST, "Email already taken");

    const role = params.role;

    const passwordHash = await encryptPassword(params.password);

    const user = await this.users.create({
      email: params.email,
      name: params.name ?? null,
      passwordHash,
      role,
    });

    return this.toSafeUser(user);
  }

  async getAll(): Promise<SafeUser[]> {
    return this.users.query({}, {});
  }

  async getAllPaged(
    query: NormalizedPagedQuery,
  ): Promise<PagedResult<SafeUser>> {
    return this.toPagedResult(query);
  }

  async searchAllPaged(
    query: NormalizedSearchablePagedQuery,
  ): Promise<PagedResult<SafeUser>> {
    return this.toPagedResult(query);
  }

  async getById(id: number): Promise<SafeUser | null> {
    const user = await this.users.findById(id);
    return user ? this.toSafeUser(user) : null;
  }

  async update(
    id: number,
    update: UpdateUserInput,
  ): Promise<SafeUser | null> {
    const existing = await this.users.findById(id);
    if (!existing) return null;

    if (update.email) {
      const clash = await this.users.findByEmail(update.email);
      if (clash && clash.id !== id) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Email already taken");
      }
    }

    const updated = await this.users.updateById(id, update);
    return this.toSafeUser(updated);
  }

  async delete(id: number): Promise<void | null> {
    const existing = await this.users.findById(id);
    if (!existing) return null;

    await this.users.deleteById(id);
  }

  async createUser(params: CreateUserRequest): Promise<SafeUser> {
    return this.create(params);
  }

  async getUserById(id: number): Promise<SafeUser> {
    const user = await this.getById(id);
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    return user;
  }

  async queryUsers(params: {
    role?: Role;
    isEmailVerified?: boolean;
    page?: number;
    limit?: number;
    sortBy?: UserSortField;
    sortOrder?: "asc" | "desc";
  }): Promise<SafeUser[]> {
    if (params.sortBy && !allowedSortFields.has(params.sortBy)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid sortBy field");
    }

    return this.users.query(
      { role: params.role, isEmailVerified: params.isEmailVerified },
      {
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      },
    );
  }

  async updateUser(
    id: number,
    update: UpdateUserInput,
  ): Promise<SafeUser> {
    const updated = await this.update(id, update);
    if (!updated) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    return updated;
  }

  async changePassword(id: number, newPassword: string): Promise<void> {
    const existing = await this.users.findById(id);
    if (!existing) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");

    const passwordHash = await encryptPassword(newPassword);
    await this.users.updatePasswordById(id, passwordHash);
  }

  async deleteUser(id: number): Promise<void> {
    const deleted = await this.delete(id);
    if (deleted === null) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }
  }

  private async toPagedResult(
    query: NormalizedPagedQuery,
  ): Promise<PagedResult<SafeUser>> {
    this.validateSortBy(query.sortBy);

    const filter = this.getFilter(query);
    const [data, total] = await Promise.all([
      this.users.query(filter, {
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy as UserSortField | undefined,
        sortOrder: query.sortOrder,
      }),
      this.users.count(filter),
    ]);

    return {
      data,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  private getFilter(query: NormalizedPagedQuery): {
    role?: Role;
    isEmailVerified?: boolean;
  } {
    return {
      role: query.role as Role | undefined,
      isEmailVerified: query.isEmailVerified as boolean | undefined,
    };
  }

  private validateSortBy(sortBy?: string): void {
    if (sortBy && !allowedSortFields.has(sortBy as UserSortField)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid sortBy field");
    }
  }

  private toSafeUser(user: { password: string } & SafeUser): SafeUser {
    const { password: _pw, ...safe } = user;
    return safe;
  }
}
