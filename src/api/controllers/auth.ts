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
import logger from "../../config/logger.js";
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

/**
 * Register nu mai intoarce tokens: contul trebuie verificat pe email inainte
 * de primul login, deci nu are rost sa dam o sesiune care oricum nu poate fi
 * reinnoita prin login.
 */
export interface RegisterResponse {
  user: SafeUser;
}

export interface ResendVerificationBody {
  email: string;
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
  public async register(@Body() body: RegisterBody): Promise<RegisterResponse> {
    const user = await this.userService.createUser({
      email: body.email,
      password: body.password,
    });

    await this.sendVerificationEmailBestEffort(user);

    this.setStatus(StatusCodes.CREATED);
    return { user };
  }

  /**
   * Retrimite emailul de verificare, fara autentificare: cine nu si-a
   * verificat adresa nu se poate loga, deci nu are cum sa obtina un token
   * ca sa ceara retrimiterea prin ruta protejata.
   *
   * Raspunde mereu 204, chiar daca adresa nu exista sau e deja verificata,
   * ca sa nu poata fi folosita ca oracol pentru descoperirea conturilor.
   */
  @Post("resend-verification-email")
  @SuccessResponse(StatusCodes.NO_CONTENT, "No Content")
  @Middlewares(validate(authValidation.resendVerificationEmail))
  public async resendVerificationEmail(
    @Body() body: ResendVerificationBody,
  ): Promise<void> {
    const user = await this.authService.findPendingVerification(body.email);

    if (user) {
      await this.sendVerificationEmailBestEffort(user);
    }

    this.setStatus(StatusCodes.NO_CONTENT);
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
    // Raspunde mereu 204, chiar daca adresa nu exista: altfel ruta devine un
    // oracol prin care oricine afla ce conturi sunt inregistrate. Acelasi
    // tratament ca la resend-verification-email.
    try {
      const token = await this.tokenService.generateResetPasswordToken(
        body.email,
      );
      await this.emailService.sendResetPasswordEmail(body.email, token);
    } catch (err) {
      logger.error(
        `Failed to send reset password email: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

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
   * Trimite emailul de verificare fara sa poata rupe inregistrarea.
   *
   * Un provider de email picat nu trebuie sa opreasca crearea conturilor:
   * userul e deja creat si logat, iar daca emailul nu pleaca poate cere
   * retrimiterea din POST /v1/auth/send-verification-email.
   */
  private async sendVerificationEmailBestEffort(user: SafeUser): Promise<void> {
    if (user.isEmailVerified) return;

    try {
      const token = await this.tokenService.generateVerifyEmailToken(user);
      await this.emailService.sendVerificationEmail(user.email, token);
    } catch (err) {
      logger.error(
        `Failed to send verification email to user ${user.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
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
