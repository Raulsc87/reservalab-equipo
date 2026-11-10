import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { refreshTokens, users } from "../db/schema.js";

interface NewRefreshToken {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export async function saveRefreshToken(
  data: NewRefreshToken
): Promise<void> {
  await db.insert(refreshTokens).values(data);
}

export async function rotateRefreshToken(
  oldHash: string,
  replacement: { tokenHash: string; expiresAt: Date }
) {
  return db.transaction(async (tx) => {
    const [previous] = await tx
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.tokenHash, oldHash),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, sql`now()`)
        )
      )
      .returning({ userId: refreshTokens.userId });

    if (!previous) {
      return null;
    }

    const [user] = await tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role
      })
      .from(users)
      .where(
        and(
          eq(users.id, previous.userId),
          eq(users.active, true)
        )
      )
      .limit(1);

    if (!user) {
      return null;
    }

    await tx.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: replacement.tokenHash,
      expiresAt: replacement.expiresAt
    });

    return user;
  });
}

export async function revokeRefreshToken(
  tokenHash: string
): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt)
      )
    );
}