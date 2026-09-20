import { StatusCodes } from "http-status-codes";
import { injectable } from "tsyringe";
import {
  Body,
  Controller,
  Middlewares,
  Post,
  Request,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from "tsoa";
import type { Request as ExRequest } from "express";

import type { User } from "../../db/schema.js";
import { validate } from "../../middlewares/validate.js";
import { authValidation } from "../../validations/index.js";
import type { AuthTokensResponse } from "../repositories/token/types.js";
import type { SafeUser } from "../repositories/user/types.js";
import {
  AuthService,
  EmailService,
  TokenService,
  UserService,
} from "../services/index.js";

export interface AuthResponse {
  user: SafeUser;
  tokens: AuthTokensResponse;
}

export interface RegisterBody {
  email: string;
  password: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface GoogleLoginBody {
  idToken: string;
}

export interface RefreshTokenBody {
  refreshToken: string;
}

export interface ForgotPasswordBody {
  email: string;
}

export interface ResetPasswordBody {
  password: string;
}

@injectable()
@Route("auth")
@Tags("Auth")
export class AuthController extends Controller {
  constructor(
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  @Post("register")
  @SuccessResponse(StatusCodes.CREATED, "Created")
  @Middlewares(validate(authValidation.register))
  public async register(@Body() body: RegisterBody): Promise<AuthResponse> {
    const user = await this.userService.createUser({
      email: body.email,
      password: body.password,
    });
    const tokens = await this.tokenService.generateAuthTokens(user);

    this.setStatus(StatusCodes.CREATED);
    return { user, tokens };
  }

  @Post("login")
  @Middlewares(validate(authValidation.login))
  public async login(@Body() body: LoginBody): Promise<AuthResponse> {
    const user = await this.authService.loginUserWithEmailAndPassword(
      body.email,
      body.password,
    );
    const tokens = await this.tokenService.generateAuthTokens(user);

    return { user, tokens };
  }

  @Post("google")
  @Middlewares(validate(authValidation.google))
  public async googleLogin(
    @Body() body: GoogleLoginBody,
  ): Promise<AuthResponse> {
    const user = await this.authService.loginWithGoogle(body.idToken);
    const tokens = await this.tokenService.generateAuthTokens(user);

    return { user, tokens };
  }

  @Post("logout")
  @SuccessResponse(StatusCodes.NO_CONTENT, "No Content")
  @Middlewares(validate(authValidation.logout))
  public async logout(@Body() body: RefreshTokenBody): Promise<void> {
    await this.authService.logout(body.refreshToken);
    this.setStatus(StatusCodes.NO_CONTENT);
  }

  @Post("refresh-tokens")
  @Middlewares(validate(authValidation.refreshTokens))
  public async refreshTokens(
    @Body() body: RefreshTokenBody,
  ): Promise<AuthTokensResponse> {
    return this.authService.refreshAuth(body.refreshToken);
  }

  @Post("forgot-password")
  @SuccessResponse(StatusCodes.NO_CONTENT, "No Content")
  @Middlewares(validate(authValidation.forgotPassword))
  public async forgotPassword(
    @Body() body: ForgotPasswordBody,
  ): Promise<void> {
    const token = await this.tokenService.generateResetPasswordToken(
      body.email,
    );
    await this.emailService.sendResetPasswordEmail(body.email, token);

    this.setStatus(StatusCodes.NO_CONTENT);
  }

  @Post("reset-password")
  @SuccessResponse(StatusCodes.NO_CONTENT, "No Content")
  @Middlewares(validate(authValidation.resetPassword))
  public async resetPassword(
    @Request() req: ExRequest,
    @Body() body: ResetPasswordBody,
  ): Promise<void> {
    await this.authService.resetPassword(
      req.query.token as string,
      body.password,
    );
    this.setStatus(StatusCodes.NO_CONTENT);
  }

  @Post("send-verification-email")
  @SuccessResponse(StatusCodes.NO_CONTENT, "No Content")
  @Security("bearerAuth")
  public async sendVerificationEmail(
    @Request() req: ExRequest,
  ): Promise<void> {
    const user = req.user as User;

    const token = await this.tokenService.generateVerifyEmailToken(user);
    await this.emailService.sendVerificationEmail(user.email, token);

    this.setStatus(StatusCodes.NO_CONTENT);
  }

  @Post("verify-email")
  @SuccessResponse(StatusCodes.NO_CONTENT, "No Content")
  @Middlewares(validate(authValidation.verifyEmail))
  public async verifyEmail(@Request() req: ExRequest): Promise<void> {
    await this.authService.verifyEmail(req.query.token as string);
    this.setStatus(StatusCodes.NO_CONTENT);
  }
}
