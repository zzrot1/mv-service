import { OAuth2Client } from "google-auth-library";
import { StatusCodes } from "http-status-codes";
import { ApiError } from "../../utils/index.js";
import type { OAuthProfile, OAuthProvider } from "../../utils/index.js";

export class GoogleOAuthProvider implements OAuthProvider {
  private readonly client: OAuth2Client;

  constructor(private readonly clientId: string) {
    this.client = new OAuth2Client(clientId);
  }

  async verify(idToken: string): Promise<OAuthProfile> {
    let payload;

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid Google ID token");
    }

    if (!payload?.sub || !payload.email) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "Google ID token is missing required claims",
      );
    }

    return {
      providerAccountId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: payload.name ?? null,
    };
  }
}

/** Used when GOOGLE_CLIENT_ID is not configured, so the route fails cleanly. */
export class DisabledOAuthProvider implements OAuthProvider {
  constructor(private readonly providerName: string) {}

  async verify(): Promise<OAuthProfile> {
    throw new ApiError(
      StatusCodes.NOT_IMPLEMENTED,
      `${this.providerName} login is not configured`,
    );
  }
}
