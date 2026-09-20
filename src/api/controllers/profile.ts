import { StatusCodes } from "http-status-codes";
import { injectable } from "tsyringe";
import {
  Body,
  Controller,
  Get,
  Middlewares,
  Patch,
  Request,
  Route,
  Security,
  Tags,
} from "tsoa";
import type { Request as ExRequest } from "express";

import { validate } from "../../middlewares/validate.js";
import { profileValidation } from "../../validations/index.js";
import type { SafeUser } from "../repositories/user/types.js";
import { ApiError } from "../../utils/index.js";
import { UserService } from "../services/index.js";

/**
 * Campurile de profil pe care si le poate edita utilizatorul.
 *
 * Declarat ca `interface`, nu `type`: tsoa inverseaza ordinea proprietatilor
 * pentru type alias-uri, ceea ce face exemplul din Swagger greu de citit.
 */
export interface ProfileBody {
  name?: string | null;
  /** Numar de telefon, ex: +40 721 123 456. */
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  /** Judetul sau regiunea. */
  county?: string | null;
  postalCode?: string | null;
  /** Cod de tara ISO 3166-1 alpha-2, ex: RO. */
  country?: string | null;
}

/**
 * Profilul utilizatorului autentificat. Id-ul vine intotdeauna din token,
 * niciodata din request, deci nimeni nu poate citi sau edita profilul altcuiva.
 */
@injectable()
@Route("profile")
@Tags("Profile")
@Security("bearerAuth")
export class ProfileController extends Controller {
  constructor(private readonly userService: UserService) {
    super();
  }

  /** Returneaza profilul utilizatorului autentificat. */
  @Get()
  public async getProfile(@Request() req: ExRequest): Promise<SafeUser> {
    return this.userService.getUserById(this.currentUserId(req));
  }

  /** Actualizeaza profilul utilizatorului autentificat. */
  @Patch()
  @Middlewares(validate(profileValidation.updateProfile))
  public async updateProfile(
    @Request() req: ExRequest,
    @Body() body: ProfileBody,
  ): Promise<SafeUser> {
    return this.userService.updateUser(this.currentUserId(req), body);
  }

  private currentUserId(req: ExRequest): number {
    const user = req.user as SafeUser | undefined;

    if (!user?.id) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Please authenticate");
    }

    return user.id;
  }
}
