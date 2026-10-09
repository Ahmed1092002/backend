import { prisma } from "../../database/prisma.js";

type CreateRefreshTokenData = {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
};

export function createRefreshToken(data: CreateRefreshTokenData) {
  return prisma.refreshToken.create({ data });
}

export function findRefreshTokenByHash(tokenHash: string) {
  return prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
}

export function deleteRefreshTokenByHash(tokenHash: string) {
  return prisma.refreshToken.deleteMany({ where: { tokenHash } });
}

export async function rotateRefreshToken(
  currentTokenHash: string,
  nextToken: CreateRefreshTokenData,
) {
  return prisma.$transaction(async (transaction) => {
    const consumed = await transaction.refreshToken.deleteMany({
      where: {
        tokenHash: currentTokenHash,
        expiresAt: { gt: new Date() },
      },
    });

    if (consumed.count !== 1) {
      return false;
    }

    await transaction.refreshToken.create({ data: nextToken });
    return true;
  });
}
