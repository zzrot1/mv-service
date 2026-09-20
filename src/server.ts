import "reflect-metadata";
import type { Server } from "node:http";
import app from "./app.js";
import { pool } from "./config/dbConnection.js";
import config from "./config/config.js";
import logger from "./config/logger.js";

let server: Server | undefined;
let shuttingDown = false;

async function start() {
  try {
    await pool.query("select 1");
    logger.info("Connected to SQL Database");

    server = app.listen(config.port, () => {
      logger.info(`Listening on port ${config.port}`);
    });
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

async function shutdown(exitCode: number, reason?: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (reason) logger.warn(reason);

  try {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      logger.info("HTTP server closed");
    }

    await pool.end();
    logger.info("Database pool disconnected");
  } catch (err) {
    logger.error(err);
  } finally {
    process.exit(exitCode);
  }
}

process.on("uncaughtException", (err) => {
  logger.error(err);
  shutdown(1, "UNCAUGHT EXCEPTION — shutting down");
});

process.on("unhandledRejection", (reason) => {
  logger.error(reason);
  shutdown(1, "UNHANDLED REJECTION — shutting down");
});

process.on("SIGTERM", () => {
  shutdown(0, "SIGTERM received — shutting down gracefully");
});

process.on("SIGINT", () => {
  shutdown(0, "SIGINT received — shutting down gracefully");
});

start();
