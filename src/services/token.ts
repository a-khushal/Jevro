import { createHmac } from "crypto";
import { Request } from "express";
import { TOKEN_SECRET } from "../config";
import { TokenClaims } from "../types";

export function createToken(claims: TokenClaims): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", TOKEN_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): TokenClaims | null {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    return null;
  }

  const expected = createHmac("sha256", TOKEN_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");

  if (signature !== expected) {
    return null;
  }

  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenClaims;
  if (Date.now() / 1000 >= claims.exp) {
    return null;
  }

  return claims;
}

export function parseBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return null;
  }
  return auth.slice("Bearer ".length).trim();
}
