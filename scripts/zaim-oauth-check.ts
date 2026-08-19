/**
 * OAuth 1.0a（HMAC-SHA1）の署名が正しいかを、公開されている既知のテストベクタで検算する。
 *
 * Zaim の consumer key が無い環境でも署名の実装だけは確かめられるようにしている。
 * 署名を直すときは必ずこれを通すこと。
 *
 *   npx tsx scripts/zaim-oauth-check.ts
 */
import { createOAuthSignature } from "../src/lib/zaim/oauth";

// Twitter の OAuth 1.0a ドキュメントにある例（HMAC-SHA1 の標準的な検算用データ）。
const params: Record<string, string> = {
  status: "Hello Ladies + Gentlemen, a signed OAuth request!",
  include_entities: "true",
  oauth_consumer_key: "xvz1evFS4wEEPTGEFPHBog",
  oauth_nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
  oauth_signature_method: "HMAC-SHA1",
  oauth_timestamp: "1318622958",
  oauth_token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
  oauth_version: "1.0",
};

const expected = "tnnArxj06cWHq44gCs1OSKk/jLY=";

const actual = createOAuthSignature(
  "POST",
  "https://api.twitter.com/1/statuses/update.json",
  params,
  "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
  "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
);

if (actual !== expected) {
  console.error(`NG: expected ${expected}, got ${actual}`);
  process.exit(1);
}

console.log("OK: OAuth 1.0a (HMAC-SHA1) signature matches the known vector");
