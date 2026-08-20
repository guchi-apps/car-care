import { prisma } from "@/lib/prisma";
import { decryptZaimSecret, encryptZaimSecret } from "@/lib/zaim/secret-box";
import type { ZaimToken } from "@/lib/zaim/oauth";

/**
 * Zaim 連携情報の読み書き。**すべてログイン中のユーザー ID で絞る。**
 *
 * 連携はユーザーごとに 1 件（zaim_connections.user_id は unique）。この層を通す限り
 * 他人の連携情報には触れないため、「自分の給油記録が他人の Zaim へ入る」経路は無い（#26）。
 */

export type ZaimConnectionView = {
  zaimUserName: string | null;
  autoRegister: boolean;
  categoryId: string | null;
  categoryName: string | null;
  genreId: string | null;
  genreName: string | null;
  accountId: string | null;
  accountName: string | null;
  lastRegisteredAt: Date | null;
  createdAt: Date;
};

export async function getZaimConnection(userId: string) {
  return prisma.zaimConnection.findUnique({ where: { userId } });
}

/** 画面へ渡す用。トークンは含めない。 */
export async function getZaimConnectionView(
  userId: string,
): Promise<ZaimConnectionView | null> {
  const connection = await getZaimConnection(userId);

  if (!connection) {
    return null;
  }

  return {
    zaimUserName: connection.zaimUserName,
    autoRegister: connection.autoRegister,
    categoryId: connection.categoryId,
    categoryName: connection.categoryName,
    genreId: connection.genreId,
    genreName: connection.genreName,
    accountId: connection.accountId,
    accountName: connection.accountName,
    lastRegisteredAt: connection.lastRegisteredAt,
    createdAt: connection.createdAt,
  };
}

export async function getZaimAccessToken(
  userId: string,
): Promise<ZaimToken | null> {
  const connection = await getZaimConnection(userId);

  if (!connection) {
    return null;
  }

  return {
    token: decryptZaimSecret(connection.accessToken),
    tokenSecret: decryptZaimSecret(connection.accessTokenSecret),
  };
}

export async function saveZaimConnection(
  userId: string,
  params: {
    token: ZaimToken;
    zaimUserId: string | null;
    zaimUserName: string | null;
  },
): Promise<void> {
  const accessToken = encryptZaimSecret(params.token.token);
  const accessTokenSecret = encryptZaimSecret(params.token.tokenSecret);

  await prisma.zaimConnection.upsert({
    where: { userId },
    create: {
      userId,
      accessToken,
      accessTokenSecret,
      zaimUserId: params.zaimUserId,
      zaimUserName: params.zaimUserName,
    },
    update: {
      accessToken,
      accessTokenSecret,
      zaimUserId: params.zaimUserId,
      zaimUserName: params.zaimUserName,
    },
  });
}

export type ZaimRegistrationTarget = {
  autoRegister: boolean;
  categoryId: string | null;
  categoryName: string | null;
  genreId: string | null;
  genreName: string | null;
  accountId: string | null;
  accountName: string | null;
};

export async function updateZaimRegistrationTarget(
  userId: string,
  target: ZaimRegistrationTarget,
): Promise<boolean> {
  const result = await prisma.zaimConnection.updateMany({
    where: { userId },
    data: target,
  });

  return result.count > 0;
}

export async function deleteZaimConnection(userId: string): Promise<boolean> {
  const result = await prisma.zaimConnection.deleteMany({ where: { userId } });
  return result.count > 0;
}

export async function markZaimRegistered(
  userId: string,
  registeredAt: Date,
): Promise<void> {
  await prisma.zaimConnection.updateMany({
    where: { userId },
    data: { lastRegisteredAt: registeredAt },
  });
}
