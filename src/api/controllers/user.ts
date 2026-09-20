import { injectable } from "tsyringe";
import { BaseController } from "../../toolkit/index.js";
import type {
  CreateUserRequest,
  SafeUser,
  UpdateUserInput,
} from "../repositories/index.js";
import { UserService } from "../services/index.js";

@injectable()
export class UserController extends BaseController<
  SafeUser,
  CreateUserRequest,
  UpdateUserInput
> {
  constructor(userService: UserService) {
    super(userService, { idParam: "userId" });
  }

  public createUser = this.create;
  public getUsers = this.getAllPaged;
  public getUser = this.getById;
  public updateUser = this.update;
  public deleteUser = this.delete;
}
