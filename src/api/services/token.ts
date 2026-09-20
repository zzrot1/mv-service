import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import dayjs, { type Dayjs } from "dayjs";
import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "../../config/dependencyTokens.js";
import { TokenType, type Token } from "../../db/schema.js";
import {
  AuthTokensResponse,
  ITokenRepository,
  IUserRepository,
} from "../repositories/index.js";
import { ApiError } from "../../utils/index.js";
import { StatusCodes } from "http-status-codes";

type JwtConfig = {
  secret: string;
  accessExpirationMinutes: number;
  refreshExpirationDays: number;
  resetPasswordExpirationMinutes: number;
  verifyEmailExpirationMinutes: number;
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

@injectable()
export class TokenService {
  constructor(
    @inject(DI_TOKENS.TokenRepository)
    private readonly tokens: ITokenRepository,
    @inject(DI_TOKENS.UserRepository)
    private readonly users: IUserRepository,
    @inject(DI_TOKENS.JwtConfig)
    private readonly jwtConfig: JwtConfig,
  ) {}

  public generateJwtToken(
    userId: number,
    expires: Dayjs,
    type: TokenType,
    secret = this.jwtConfig.secret,
  ) {
    const payload = {
      sub: userId,
      iat: dayjs().unix(),
      exp: expires.unix(),
      type,
    };
    return jwt.sign(payload, secret);
  }

  public async saveTokenHash(params: {
    token: string;
    userId: number;
    expires: Dayjs;
    type: TokenType;
    blacklisted?: boolean;
  }): Promise<Token> {
    return this.tokens.create({
      tokenHash: hashToken(params.token),
      userId: params.userId,
      expires: params.expires.toDate(),
      type: params.type,
      blacklisted: params.blacklisted ?? false,
    });
  }

  public async verifyToken(token: string, type: TokenType): Promise<Token> {
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, this.jwtConfig.secret) as jwt.JwtPayload;
    } catch {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid token");
    }

    const userId = Number(payload.sub);
    if (!Number.isFinite(userId))
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid token payload");

    const tokenDoc = await this.tokens.findValid({
      tokenHash: hashToken(token),
      type,
      userId,
    });

    if (!tokenDoc)
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Token not found");
    return tokenDoc;
  }

  public async generateAuthTokens(user: {
    id: number;
  }): Promise<AuthTokensResponse> {
    const accessExpires = dayjs().add(
      this.jwtConfig.accessExpirationMinutes,
      "minute",
    );
    const accessToken = this.generateJwtToken(
      user.id,
      accessExpires,
      TokenType.ACCESS,
    );

    const refreshExpires = dayjs().add(
      this.jwtConfig.refreshExpirationDays,
      "day",
    );
    const refreshToken = this.generateJwtToken(
      user.id,
      refreshExpires,
      TokenType.REFRESH,
    );

    await this.saveTokenHash({
      token: refreshToken,
      userId: user.id,
      expires: refreshExpires,
      type: TokenType.REFRESH,
    });

    return {
      access: { token: accessToken, expires: accessExpires.toDate() },
      refresh: { token: refreshToken, expires: refreshExpires.toDate() },
    };
  }

  public async generateResetPasswordToken(email: string): Promise<string> {
    const user = await this.users.findByEmail(email);
    if (!user)
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "No users found with this email",
      );

    const expires = dayjs().add(
      this.jwtConfig.resetPasswordExpirationMinutes,
      "minute",
    );
    const resetToken = this.generateJwtToken(
      user.id,
      expires,
      TokenType.RESET_PASSWORD,
    );

    await this.saveTokenHash({
      token: resetToken,
      userId: user.id,
      expires,
      type: TokenType.RESET_PASSWORD,
    });

    return resetToken;
  }

  public async generateVerifyEmailToken(user: { id: number }): Promise<string> {
    const expires = dayjs().add(
      this.jwtConfig.verifyEmailExpirationMinutes,
      "minute",
    );
    const verifyToken = this.generateJwtToken(
      user.id,
      expires,
      TokenType.VERIFY_EMAIL,
    );

    await this.saveTokenHash({
      token: verifyToken,
      userId: user.id,
      expires,
      type: TokenType.VERIFY_EMAIL,
    });

    return verifyToken;
  }

  public async blacklistToken(token: string, type: TokenType): Promise<void> {
    const tokenDoc = await this.verifyToken(token, type);
    await this.tokens.blacklistById(tokenDoc.id);
  }

  public async deleteExpiredTokens(): Promise<number> {
    return this.tokens.deleteExpired(new Date());
  }
}
