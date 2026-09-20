import { StatusCodes } from "http-status-codes";
import { injectable } from "tsyringe";
import {
  Body,
  Controller,
  Delete,
  Get,
  Middlewares,
  Patch,
  Path,
  Post,
  Query,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from "tsoa";

import type { Role } from "../../db/schema.js";
import { validate } from "../../middlewares/validate.js";
import { userValidation } from "../../validations/index.js";
import type {
  SafeUser,
  UserSortField,
} from "../repositories/user/types.js";
import type { PagedResult } from "../../toolkit/pagination.js";
import type { SortOrder } from "../../utils/utils.js";
import { normalizePagedQuery } from "../../toolkit/index.js";
import { ApiError } from "../../utils/index.js";
import { UserService } from "../services/index.js";
import type { ProfileBody } from "./profile.js";

export interface CreateUserBody extends ProfileBody {
  email: string;
  password: string;
  role: Role;
}

export interface UpdateUserBody extends ProfileBody {
  email?: string;
  password?: string;
  role?: Role;
}

@injectable()
@Route("users")
@Tags("Users")
@Security("bearerAuth", ["manageUsers"])
export class UserController extends Controller {
  constructor(private readonly userService: UserService) {
    super();
  }

  /** Creeaza un utilizator. Doar administratori. */
  @Post()
  @SuccessResponse(StatusCodes.CREATED, "Created")
  @Middlewares(validate(userValidation.createUser))
  public async createUser(@Body() body: CreateUserBody): Promise<SafeUser> {
    this.setStatus(StatusCodes.CREATED);
    return this.userService.createUser(body);
  }

  /** Listeaza utilizatorii, paginat. Doar administratori. */
  @Get()
  @Security("bearerAuth", ["getUsers"])
  @Middlewares(validate(userValidation.getUsers))
  public async getUsers(
    @Query() page?: number,
    @Query() limit?: number,
    @Query() sortBy?: UserSortField,
    @Query() sortOrder?: SortOrder,
    @Query() role?: Role,
  ): Promise<PagedResult<SafeUser>> {
    return this.userService.getAllPaged(
      normalizePagedQuery({ page, limit, sortBy, sortOrder, role }),
    );
  }

  /** Returneaza un utilizator dupa id. Doar administratori. */
  @Get("{userId}")
  @Security("bearerAuth", ["getUsers"])
  @Middlewares(validate(userValidation.getUser))
  public async getUser(@Path() userId: number): Promise<SafeUser> {
    const user = await this.userService.getById(userId);

    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    return user;
  }

  /** Actualizeaza un utilizator. Doar administratori. */
  @Patch("{userId}")
  @Middlewares(validate(userValidation.updateUser))
  public async updateUser(
    @Path() userId: number,
    @Body() body: UpdateUserBody,
  ): Promise<SafeUser> {
    return this.userService.updateUser(userId, body);
  }

  /** Sterge un utilizator. Doar administratori. */
  @Delete("{userId}")
  @SuccessResponse(StatusCodes.NO_CONTENT, "No Content")
  @Middlewares(validate(userValidation.deleteUser))
  public async deleteUser(@Path() userId: number): Promise<void> {
    await this.userService.deleteUser(userId);
    this.setStatus(StatusCodes.NO_CONTENT);
  }
}
