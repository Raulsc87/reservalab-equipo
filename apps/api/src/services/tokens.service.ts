import jwt from "jsonwebtoken";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { resolve } from "node:path";
import { config } from "dotenv";
import type { Role } from "@reservalab/shared";
import { roleSchema } from "@reservalab/shared";
config({
  path: resolve(process.cwd(), "../../.env"),
  quiet: true
});

export function createAccessToken(user: { id: string; role: Role }) {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret || secret.length < 64) {
    throw new Error("Configura JWT_ACCESS_SECRET con la clave generada");
  }

  return jwt.sign(
    {
      role: user.role,
      tokenType: "access"
    },
    secret,
    {
      algorithm: "HS256",
      expiresIn: 900,
      subject: user.id,
      issuer: "reservalab-api",
      audience: "reservalab",
      jwtid: randomUUID()
    }
 
);


}
export function verifyAccessToken(token: string) {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret || secret.length < 64) {
    throw new Error("Falta configurar JWT_ACCESS_SECRET");
  }

  const payload = jwt.verify(token, secret, {
    algorithms: ["HS256"],
    issuer: "reservalab-api",
    audience: "reservalab"
  });

  if (
    typeof payload === "string" ||
    typeof payload.sub !== "string" ||
    typeof payload.exp !== "number" ||
    payload.tokenType !== "access"
  ) {
    throw new Error("Token invalido");
  }

  const role = roleSchema.parse(payload.role);

  return {
    id: payload.sub,
    role
  };
  
}
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createRefreshToken() {
  const token = randomBytes(32).toString("hex");

  return {
    token,
    tokenHash: hashRefreshToken(token),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };
}