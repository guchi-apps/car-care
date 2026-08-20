import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Zaim のアクセストークンを暗号化して DB に置くための小さな箱。
 *
 * トークンは「その人の家計簿を書き換えられる鍵」で、パスワード相当の秘密情報にあたる。
 * DB のバックアップや Prisma Studio の画面にそのまま出ないよう、AES-256-GCM で包んでから保存する。
 * 鍵は ZAIM_TOKEN_ENCRYPTION_KEY（十分に長いランダム文字列）から scrypt で導出する。
 *
 * 依存関係は増やさない（node 標準の crypto だけを使う）。
 */

const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SCRYPT_SALT = "car-care/zaim/v1";
const FORMAT_VERSION = "v1";

function getEncryptionKey(): Buffer {
  const secret = process.env.ZAIM_TOKEN_ENCRYPTION_KEY?.trim();

  if (!secret) {
    throw new Error("ZAIM_TOKEN_ENCRYPTION_KEY が設定されていません");
  }

  if (secret.length < 16) {
    throw new Error(
      "ZAIM_TOKEN_ENCRYPTION_KEY が短すぎます（16文字以上のランダム文字列にしてください）",
    );
  }

  return scryptSync(secret, SCRYPT_SALT, KEY_LENGTH);
}

export function encryptZaimSecret(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);

  return [
    FORMAT_VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptZaimSecret(cipherText: string): string {
  const [version, ivPart, tagPart, payloadPart] = cipherText.split(":");

  if (version !== FORMAT_VERSION || !ivPart || !tagPart || !payloadPart) {
    throw new Error("保存されている Zaim のトークンを復号できません");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivPart, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(payloadPart, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** 暗号鍵が設定されているか（設定画面で連携を出す前の判定に使う）。 */
export function isZaimSecretBoxReady(): boolean {
  const secret = process.env.ZAIM_TOKEN_ENCRYPTION_KEY?.trim();
  return Boolean(secret && secret.length >= 16);
}
