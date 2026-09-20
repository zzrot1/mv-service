import { StatusCodes } from "http-status-codes";
import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "../../config/dependencyTokens.js";
import { TokenType, type User } from "../../db/schema.js";

import { ApiError } from "../../utils/index.js";
import { isPasswordMatch } from "../../utils/encryption.js";

import type { AuthTokensResponse, ITokenRepository, IUserRepository, SafeUser } from "../repositories/index.js";
import { TokenService, UserService } from "./index.js";


@injectable()
export class AuthService {
  constructor(
    @inject(DI_TOKENS.UserRepository)
    private readonly usersRepo: IUserRepository,
    private readonly userService: UserService, 
    private readonly tokenService: TokenService, 
    @inject(DI_TOKENS.TokenRepository)
    private readonly tokenRepo: ITokenRepository 
  ) {}

  /**
   * Login cu email + parolă
   * Returnează SafeUser (fără password)
   */
  public async loginUserWithEmailAndPassword(
    email: string,
    password: string
  ): Promise<SafeUser> {
    const user = (await this.usersRepo.findByEmail(email)) as unknown as User | null;

    if (!user || !(await isPasswordMatch(password, user.password))) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Incorrect email or password");
    }

    // transform în SafeUser
    // (SafeUser-ul tău pare să fie User fără password)
    // Dacă SafeUser mai exclude câmpuri, ajustezi aici.
    const { password: _pw, ...safe } = user;
    return safe as SafeUser;
  }

  /**
   * Logout = revoc refresh token (blacklist)
   */
  public async logout(refreshToken: string): Promise<void> {
    const tokenDoc = await this.tokenService.verifyToken(refreshToken, TokenType.REFRESH);
    await this.tokenRepo.blacklistById(tokenDoc.id);
  }

  /**
   * Refresh auth tokens (rotation)
   */
  public async refreshAuth(refreshToken: string): Promise<AuthTokensResponse> {
    try {
      const tokenDoc = await this.tokenService.verifyToken(refreshToken, TokenType.REFRESH);

      // revocă refresh token-ul vechi
      await this.tokenRepo.blacklistById(tokenDoc.id);

      // generează set nou
      return await this.tokenService.generateAuthTokens({ id: tokenDoc.userId });
    } catch {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Please authenticate");
    }
  }

  /**
   * Reset password
   */
  public async resetPassword(resetPasswordToken: string, newPassword: string): Promise<void> {
    try {
      const tokenDoc = await this.tokenService.verifyToken(
        resetPasswordToken,
        TokenType.RESET_PASSWORD
      );

      // schimbă parola prin UserService (safe)
      await this.userService.changePassword(tokenDoc.userId, newPassword);

      // revocă toate reset tokens pentru user
      await this.tokenRepo.blacklistManyByUserAndType(tokenDoc.userId, TokenType.RESET_PASSWORD);
    } catch {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Password reset failed");
    }
  }

  /**
   * Verify email
   */
  public async verifyEmail(verifyEmailToken: string): Promise<void> {
    try {
      const tokenDoc = await this.tokenService.verifyToken(
        verifyEmailToken,
        TokenType.VERIFY_EMAIL
      );

      // revocă toate verify tokens
      await this.tokenRepo.blacklistManyByUserAndType(tokenDoc.userId, TokenType.VERIFY_EMAIL);

      // marchează user-ul verificat
      await this.userService.updateUser(tokenDoc.userId, { isEmailVerified: true });
    } catch {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Email verification failed");
    }
  }
}
