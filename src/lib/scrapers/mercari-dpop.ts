import { generateKeyPairSync, randomUUID, sign } from "node:crypto";

/**
 * メルカリ API 用 DPoP (RFC 9449) JWT 生成。
 *
 * リクエスト毎に ECDSA P-256 鍵ペアを生成し、ES256 で signing input を
 * 署名する。署名は JWS 仕様 (raw r||s 形式 = ieee-p1363) で。
 */

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function generateMercariDpop(method: string, url: string): string {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const jwk = publicKey.export({ format: "jwk" }) as {
    kty?: string;
    crv?: string;
    x?: string;
    y?: string;
  };
  const header = {
    alg: "ES256",
    typ: "dpop+jwt",
    jwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
  };
  const payload = {
    iat: Math.floor(Date.now() / 1000),
    jti: randomUUID(),
    htu: url,
    htm: method,
    uuid: randomUUID(),
  };
  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${base64UrlEncode(signature)}`;
}
