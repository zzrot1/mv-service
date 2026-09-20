import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import { StatusCodes } from "http-status-codes";

import config from "./config/config.js";
import morgan from "./config/morgan.js";
import routes from "./api/routes/v1/index.js";
import { authLimiter } from "./middlewares/rateLimiter.js";
import xss from "xss";
import { jwtStrategy } from "./config/passport.js";
import { errorConverter, errorHandler } from "./middlewares/error.js";
import { ApiError } from "./utils/index.js";

const app = express();

if (config.env !== "test") {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// set security HTTP headers
app.use(helmet());

// parse json request body
app.use(express.json());

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// sanitize request data
app.use((req, res, next) => {
  if (typeof req.body === "string") {
    req.body = xss(req.body);
  }
  next();
});

app.use(compression());

// parse cookies (refresh token-ul vine in cookie httpOnly)
app.use(cookieParser());

// CORS. `credentials` e obligatoriu ca browserul sa trimita cookie-ul, iar
// el nu functioneaza cu origin "*", deci in productie cerem lista explicita.
const corsOptions: cors.CorsOptions = config.cors.origins.length
  ? { origin: config.cors.origins, credentials: true }
  : { origin: true, credentials: true };

app.use(cors(corsOptions));
app.options("/*path", cors(corsOptions));

// jwt authentication
app.use(passport.initialize());
passport.use("jwt", jwtStrategy);

// limit repeated failed requests to auth endpoints
if (config.env === "production") {
  app.use("/v1/auth", authLimiter);
}

// v1 api routes
app.use("/v1", routes);

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(StatusCodes.NOT_FOUND, "Not found"));
});

// convert error to ApiError, if needed
app.use(errorConverter);

app.use(errorHandler);

export default app;
