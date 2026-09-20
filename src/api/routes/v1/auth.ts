import express from "express";
import { validate } from "../../../middlewares/validate.js";
import { authValidation } from "../../../validations/index.js";
import { AuthController } from "../../controllers/auth.js";
import { container } from "../../../config/dependencyInjection.js";

const router = express.Router();

const authController = container.resolve(AuthController);

router.post("/login", validate(authValidation.login), authController.login);
// router.post('/register', validate(authValidation.register), authController.register);
// router.post('/logout', validate(authValidation.logout), authController.logout);
// router.post(
//   '/refresh-tokens',
//   validate(authValidation.refreshTokens),
//   authController.refreshTokens
// );
// router.post(
//   '/forgot-password',
//   validate(authValidation.forgotPassword),
//   authController.forgotPassword
// );
// router.post(
//   '/reset-password',
//   validate(authValidation.resetPassword),
//   authController.resetPassword
// );
// router.post('/send-verification-email', auth(), authController.sendVerificationEmail);
// router.post('/verify-email', validate(authValidation.verifyEmail), authController.verifyEmail);

export default router;
