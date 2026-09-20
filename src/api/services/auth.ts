import { StatusCodes } from "http-status-codes";
import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "../../config/dependencyTokens.js";
import { AuthProvider, TokenType, type User } from "../../db/schema.js";

import { ApiError } from "../../utils/index.js";
import logger from "../../config/logger.js";
import type { OAuthProfile, OAuthProvider } from "../../utils/index.js";
import { isPasswordMatch } from "../../utils/encryption.js";

import type { AuthTokensResponse, IAccountRepository, ITokenRepository, IUserRepository, SafeUser } from "../repositories/index.js";
import { TokenService, UserService } from "./index.js";


@injectable()
export class AuthService {
  constructor(
    @inject(DI_TOKENS.UserRepository)
    private readonly usersRepo: IUserRepository,
    private readonly userService: UserService, 
    private readonly tokenService: TokenService, 
    @inject(DI_TOKENS.TokenRepository)
    private readonly tokenRepo: ITokenRepository,
    @inject(DI_TOKENS.AccountRepository)
    private readonly accountRepo: IAccountRepository,
    @inject(DI_TOKENS.GoogleOAuthProvider)
    private readonly googleProvider: OAuthProvider,
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

    // user.password is null for accounts created through an OAuth provider:
    // they can only sign in through that provider until they set a password.
    if (!user?.password || !(await isPasswordMatch(password, user.password))) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Incorrect email or password");
    }

    // Verificarea vine dupa parola intentionat: altfel raspunsul ar spune
    // unui atacator ca adresa exista, inainte sa demonstreze ca stie parola.
    if (!user.isEmailVerified) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Email not verified",
      );
    }

    // transform în SafeUser
    // (SafeUser-ul tău pare să fie User fără password)
    // Dacă SafeUser mai exclude câmpuri, ajustezi aici.
    const { password: _pw, ...safe } = user;
    return safe as SafeUser;
  }

  /**
   * Login cu Google: clientul trimite ID token-ul primit de la Google Sign-In.
   */
  public async loginWithGoogle(idToken: string): Promise<SafeUser> {
    const profile = await this.googleProvider.verify(idToken);
    return this.loginWithProvider(AuthProvider.GOOGLE, profile);
  }

  /**
   * Find-or-create pentru o identitate venită de la un provider OAuth.
   *
   * 1. dacă identitatea e deja legată -> login direct
   * 2. dacă emailul există deja -> leg contul, dar doar dacă providerul
   *    a confirmat emailul (altfel oricine ar putea revendica adresa)
   * 3. altfel -> user nou, fără parolă
   */
  private async loginWithProvider(
    provider: AuthProvider,
    profile: OAuthProfile,
  ): Promise<SafeUser> {
    const linked = await this.accountRepo.findByProviderAccount(
      provider,
      profile.providerAccountId,
    );

    if (linked) {
      const user = await this.usersRepo.findById(linked.userId);
      if (!user) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "Please authenticate");
      }
      return this.toSafeUser(user);
    }

    if (!profile.emailVerified) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        `${provider} account has an unverified email address`,
      );
    }

    const email = profile.email.toLowerCase();
    const existing = await this.usersRepo.findByEmail(email);

    if (existing) {
      await this.accountRepo.create({
        userId: existing.id,
        provider,
        providerAccountId: profile.providerAccountId,
      });

      if (!existing.isEmailVerified) {
        const updated = await this.usersRepo.updateById(existing.id, {
          isEmailVerified: true,
        });
        return this.toSafeUser(updated);
      }

      return this.toSafeUser(existing);
    }

    const created = await this.usersRepo.create({
      email,
      name: profile.name ?? null,
      isEmailVerified: true,
    });

    await this.accountRepo.create({
      userId: created.id,
      provider,
      providerAccountId: profile.providerAccountId,
    });

    return this.toSafeUser(created);
  }

  private toSafeUser(user: User): SafeUser {
    const { password: _pw, ...safe } = user;
    return safe;
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
    } catch (err) {
      // Resetarea ramane strict single-use: un replay ar schimba parola din nou.
      logger.error(
        `Password reset failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
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
    } catch (err) {
      // Linkul se consuma o singura data, dar poate fi cerut de mai multe
      // ori: React Strict Mode in dev, un refresh, sau scannerele de linkuri
      // ale furnizorilor de email, care prefetch-uiesc URL-urile. Daca
      // rezultatul e deja atins, a doua cerere nu e o eroare.
      if (await this.isEmailAlreadyVerified(verifyEmailToken)) return;

      logger.error(
        `Email verification failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Email verification failed");
    }
  }

  /**
   * Userul caruia i s-ar putea retrimite emailul de verificare.
   * Returneaza null si cand adresa nu exista, si cand e deja verificata, ca
   * apelantul sa nu poata deosebi cazurile si sa nu scurga existenta conturilor.
   */
  public async findPendingVerification(email: string): Promise<SafeUser | null> {
    const user = await this.usersRepo.findByEmail(email.toLowerCase());

    if (!user || user.isEmailVerified) return null;
    return this.toSafeUser(user);
  }

  private async isEmailAlreadyVerified(token: string): Promise<boolean> {
    // Semnatura dovedeste ca tokenul a fost emis de noi; expirarea o ignoram
    // fiindca nu acordam nimic, doar constatam o stare deja existenta.
    const userId = this.tokenService.readUserIdFromToken(
      token,
      TokenType.VERIFY_EMAIL,
      { ignoreExpiration: true },
    );

    if (!userId) return false;

    const user = await this.usersRepo.findById(userId);
    return user?.isEmailVerified === true;
  }
}
