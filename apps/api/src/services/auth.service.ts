import { hash, compare } from "bcryptjs";
import type { RegisterInput, LoginInput } from "@reservalab/shared";
import {
  createUser,
  findUserByEmail
} from "../repositories/users.repository.js";
import {
  createAccessToken,
  createRefreshToken
} from "./tokens.service.js";
import {
  saveRefreshToken
} from "../repositories/refresh-tokens.repository.js";

export async function registerUser(data: RegisterInput) {
  const passwordHash = await hash(data.password, 12);

  return createUser({
    name: data.name,
    email: data.email.toLowerCase(),
    passwordHash
  });
}

export async function loginUser(data: LoginInput) {
  if (Buffer.byteLength(data.password, "utf8") > 72) {
    return null;
  }

  const user = await findUserByEmail(data.email.toLowerCase());

  if (!user || !user.active) {
    return null;
  }

  const passwordMatches = await compare(
    data.password,
    user.passwordHash
  );

  if (!passwordMatches) {
    return null;
  }

  const accessToken = createAccessToken(user);
  const refresh = createRefreshToken();

  await saveRefreshToken({
    userId: user.id,
    tokenHash: refresh.tokenHash,
    expiresAt: refresh.expiresAt
  });

  return {
    accessToken,
    refreshToken: refresh.token,
    tokenType: "Bearer",
    expiresIn: 900,
    refreshExpiresAt: refresh.expiresAt,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
}