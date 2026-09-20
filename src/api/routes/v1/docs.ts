import express from "express";
import swaggerUi from "swagger-ui-express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swaggerPath = path.resolve(__dirname, "../../swagger.json");
const swaggerDoc = JSON.parse(fs.readFileSync(swaggerPath, "utf-8"));

router.get("/openapi.json", (_req, res) => res.json(swaggerDoc));

router.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    explorer: true,
    customSiteTitle: "API v1 Docs",
    swaggerOptions: {
      url: "/v1/docs/openapi.json",
    },
  }),
);

export default router;
