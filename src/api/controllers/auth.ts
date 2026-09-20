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
import type { Request as ExRequest, Response as ExResponse } from "express";

import type { User } from "../../db/schema.js";
import { verifyRequestOrigin } from "../../middlewares/csrf.js";
import { validate } from "../../middlewares/validate.js";
import config from "../../config/config.js";
import {
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from "../../utils/index.js";
import { ApiError } from "../../utils/index.js";
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
  /**
   * Optional. Daca lipseste, se foloseste cookie-ul httpOnly `refreshToken`.
   * Clientii browser il lasa gol; cei non-browser il pot trimite aici.
   */
  refreshToken?: string;
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
  public async register(
    @Request() req: ExRequest,
    @Body() body: RegisterBody,
  ): Promise<AuthResponse> {
    const user = await this.userService.createUser({
      email: body.email,
      password: body.password,
    });
    const tokens = await this.tokenService.generateAuthTokens(user);

    this.issueRefreshCookie(req, tokens);
    this.setStatus(StatusCodes.CREATED);
    return { user, tokens };
  }

  @Post("login")
  @Middlewares(validate(authValidation.login))
  public async login(
    @Request() req: ExRequest,
    @Body() body: LoginBody,
  ): Promise<AuthResponse> {
    const user = await this.authService.loginUserWithEmailAndPassword(
      body.email,
      body.password,
    );
    const tokens = await this.tokenService.generateAuthTokens(user);

    this.issueRefreshCookie(req, tokens);
    return { user, tokens };
  }

  @Post("google")
  @Middlewares(validate(authValidation.google))
  public async googleLogin(
    @Request() req: ExRequest,
    @Body() body: GoogleLoginBody,
  ): Promise<AuthResponse> {
    const user = await this.authService.loginWithGoogle(body.idToken);
    const tokens = await this.tokenService.generateAuthTokens(user);

    this.issueRefreshCookie(req, tokens);
    return { user, tokens };
  }

  @Post("logout")
  @SuccessResponse(StatusCodes.NO_CONTENT, "No Content")
  @Middlewares(verifyRequestOrigin, validate(authValidation.logout))
  public async logout(
    @Request() req: ExRequest,
    @Body() body: RefreshTokenBody,
  ): Promise<void> {
    await this.authService.logout(this.readRefreshToken(req, body));

    clearRefreshTokenCookie(req.res as ExResponse);
    this.setStatus(StatusCodes.NO_CONTENT);
  }

  @Post("refresh-tokens")
  @Middlewares(verifyRequestOrigin, validate(authValidation.refreshTokens))
  public async refreshTokens(
    @Request() req: ExRequest,
    @Body() body: RefreshTokenBody,
  ): Promise<AuthTokensResponse> {
    const tokens = await this.authService.refreshAuth(
      this.readRefreshToken(req, body),
    );

    this.issueRefreshCookie(req, tokens);
    return tokens;
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

  /**
   * Refresh token-ul pleaca in cookie httpOnly. Ramane si in body pentru
   * clientii non-browser (mobil, Swagger), care nu au unde sa tina cookies.
   */
  private issueRefreshCookie(req: ExRequest, tokens: AuthTokensResponse): void {
    if (!tokens.refresh) return;

    setRefreshTokenCookie(
      req.res as ExResponse,
      tokens.refresh.token,
      tokens.refresh.expires,
    );
  }

  /** Cookie-ul are prioritate; body-ul e fallback pentru clienti non-browser. */
  private readRefreshToken(req: ExRequest, body: RefreshTokenBody): string {
    const token =
      (req.cookies?.[config.cookie.refreshName] as string | undefined) ??
      body.refreshToken;

    if (!token) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Missing refresh token");
    }

    return token;
  }
}
