import type { Request, Response } from "express";
import type { User } from "../../db/schema.js";
import { StatusCodes } from "http-status-codes";
import { injectable } from "tsyringe";

import { catchAsync, exclude } from "../../utils/index.js";
import { AuthService, EmailService, TokenService, UserService } from "../services/index.js";


@injectable()
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
  ) {}

  public register = catchAsync(async (req: Request, res: Response) => {
    const { email, password } = req.body as { email: string; password: string };

    const user = await this.userService.createUser({email, password});

    const userWithoutPassword = exclude(user, [
      "createdAt",
      "updatedAt",
    ]);
    const tokens = await this.tokenService.generateAuthTokens(user);

    res.status(StatusCodes.CREATED).send({ user: userWithoutPassword, tokens });
  });

  public login = catchAsync(async (req: Request, res: Response) => {
    const { email, password } = req.body as { email: string; password: string };

    const user = await this.authService.loginUserWithEmailAndPassword(
      email,
      password,
    );
    const tokens = await this.tokenService.generateAuthTokens(user);

    res.send({ user, tokens });
  });

  public logout = catchAsync(async (req: Request, res: Response) => {
    const { refreshToken } = req.body as { refreshToken: string };

    await this.authService.logout(refreshToken);
    res.status(StatusCodes.NO_CONTENT).send();
  });

  public refreshTokens = catchAsync(async (req: Request, res: Response) => {
    const { refreshToken } = req.body as { refreshToken: string };

    const tokens = await this.authService.refreshAuth(refreshToken);
    res.send(tokens);
  });

  public forgotPassword = catchAsync(async (req: Request, res: Response) => {
    const { email } = req.body as { email: string };

    const resetPasswordToken =
      await this.tokenService.generateResetPasswordToken(email);
    await this.emailService.sendResetPasswordEmail(email, resetPasswordToken);

    res.status(StatusCodes.NO_CONTENT).send();
  });

  public resetPassword = catchAsync(async (req: Request, res: Response) => {
    const { password } = req.body as { password: string };
    const token = req.query.token as string;

    await this.authService.resetPassword(token, password);
    res.status(StatusCodes.NO_CONTENT).send();
  });

  public sendVerificationEmail = catchAsync(
    async (req: Request, res: Response) => {
      const user = req.user as User;

      const verifyEmailToken =
        await this.tokenService.generateVerifyEmailToken(user);
      await this.emailService.sendVerificationEmail(
        user.email,
        verifyEmailToken,
      );

      res.status(StatusCodes.NO_CONTENT).send();
    },
  );

  public verifyEmail = catchAsync(async (req: Request, res: Response) => {
    const token = req.query.token as string;

    await this.authService.verifyEmail(token);
    res.status(StatusCodes.NO_CONTENT).send();
  });
}
