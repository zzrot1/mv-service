import express from "express";
import auth from "../../../middlewares/auth.js";
import { validate } from "../../../middlewares/validate.js";
import { userValidation } from "../../../validations/user.js";
import { UserController } from "../../controllers/user.js";
import { container } from "../../../config/dependencyInjection.js";

const router = express.Router();

const userController = container.resolve(UserController);

router
  .route("/")
  .post(
    auth("manageUsers"),
    validate(userValidation.createUser),
    userController.createUser,
  )
  .get(
    auth("getUsers"),
    validate(userValidation.getUsers),
    userController.getUsers,
  );

router
  .route("/:userId")
  .get(
    auth("getUsers"),
    validate(userValidation.getUser),
    userController.getUser,
  )
  .patch(
    auth("manageUsers"),
    validate(userValidation.updateUser),
    userController.updateUser,
  )
  .delete(
    auth("manageUsers"),
    validate(userValidation.deleteUser),
    userController.deleteUser,
  );

export default router;
