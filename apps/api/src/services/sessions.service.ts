import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken
} from "./tokens.service.js";
import {
  rotateRefreshToken,
  revokeRefreshToken
} from "../repositories/refresh-tokens.repository.js";

export async function renewSession(token: string) {
  const replacement = createRefreshToken();

  const user = await rotateRefreshToken(
    hashRefreshToken(token),
    {
      tokenHash: replacement.tokenHash,
      expiresAt: replacement.expiresAt
    }
  );

  if (!user) {
    return null;
  }

  return {
    accessToken: createAccessToken(user),
    refreshToken: replacement.token,
    tokenType: "Bearer",
    expiresIn: 900,
    refreshExpiresAt: replacement.expiresAt,
    user
  };
}

export async function endSession(token: string): Promise<void> {
  await revokeRefreshToken(hashRefreshToken(token));
}