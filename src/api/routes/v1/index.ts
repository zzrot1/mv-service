import express from "express";
import config from "../../../config/config.js";
import docsRoute from "./docs.js";
import { RegisterRoutes } from "../../generated/routes.js";

const router = express.Router();

// Rutele /auth, /users si /profile sunt generate de tsoa din decoratorii
// controllerelor (`npm run tsoa:all`), nu declarate manual aici.
RegisterRoutes(router);

/* ignore next */
if (config.env === "development") {
  router.use("/docs", docsRoute);
}

export default router;
