import type { Token, TokenType } from "../../../db/schema.js";

export interface ITokenRepository {
  create(data: {
    tokenHash: string;
    userId: number;
    expires: Date;
    type: TokenType;
    blacklisted?: boolean;
  }): Promise<Token>;

  findValid(params: {
    tokenHash: string;
    type: TokenType;
    userId: number;
  }): Promise<Token | null>;

  blacklistById(id: number): Promise<void>;
  blacklistManyByUserAndType(userId: number, type: TokenType): Promise<number>;

  deleteByUserId(userId: number): Promise<number>;

  deleteExpired(now?: Date): Promise<number>;
}

export interface TokenResponse {
  token: string;
  expires: Date;
}

export interface AuthTokensResponse {
  access: TokenResponse;
  refresh?: TokenResponse;
}
