import { createHmac, randomUUID } from "crypto";
import { Request } from "express";
import { TOKEN_DEFAULT_KID, TOKEN_SECRET } from "../config";
import {
  activateSigningKey,
  createSigningKey,
  ensureDefaultActiveSigningKey,
  getActiveSigningKey,
  getRevokedTokenByJti,
  getSigningKeyByKid,
  revokeToken
} from "../db";
import { TokenClaims } from "../types";

type TokenHeader = {
  alg: "HS256";
  typ: "JWT";
  kid: string;
};

type TokenOptions = {
  secret?: string;
  kid?: string;
};

type ParsedToken = {
  header: TokenHeader;
  claims: TokenClaims;
  signature: string;
  signingInput: string;
};

function encodeHeader(header: TokenHeader): string {
  return Buffer.from(JSON.stringify(header)).toString("base64url");
}

function encodeClaims(claims: TokenClaims): string {
  return Buffer.from(JSON.stringify(claims)).toString("base64url");
}

function decodeJson<T>(segment: string): T | null {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
  } catch (_error) {
    return null;
  }
}

function sign(signingInput: string, secret: string): string {
  return createHmac("sha256", secret).update(signingInput).digest("base64url");
}

function parseToken(token: string): ParsedToken | null {
  const [headerSegment, payloadSegment, signature] = token.split(".");
  if (!headerSegment || !payloadSegment || !signature) {
    return null;
  }

  const header = decodeJson<TokenHeader>(headerSegment);
  const claims = decodeJson<TokenClaims>(payloadSegment);
  if (!header || !claims || header.alg !== "HS256" || header.typ !== "JWT" || !header.kid) {
    return null;
  }

  return {
    header,
    claims,
    signature,
    signingInput: `${headerSegment}.${payloadSegment}`
  };
}

function isExpired(exp: number): boolean {
  return Date.now() / 1000 >= exp;
}

async function ensureActiveSigningKeyRecord(): Promise<{ kid: string; secret: string }> {
  let active = await getActiveSigningKey();
  if (!active) {
    active = await ensureDefaultActiveSigningKey({
      kid: TOKEN_DEFAULT_KID,
      secret: TOKEN_SECRET
    });
  }

  if (!active) {
    throw new Error("Unable to initialize active signing key");
  }

  return {
    kid: active.kid,
    secret: active.secret
  };
}

export function createToken(claims: TokenClaims, options?: TokenOptions): string {
  const kid = options?.kid ?? TOKEN_DEFAULT_KID;
  const secret = options?.secret ?? TOKEN_SECRET;
  const headerSegment = encodeHeader({ alg: "HS256", typ: "JWT", kid });
  const payloadSegment = encodeClaims(claims);
  const signingInput = `${headerSegment}.${payloadSegment}`;
  const signature = sign(signingInput, secret);
  return `${signingInput}.${signature}`;
}

export function verifyToken(token: string, options?: TokenOptions): TokenClaims | null {
  const parsed = parseToken(token);
  if (!parsed) {
    return null;
  }

  const secret = options?.secret ?? TOKEN_SECRET;
  const kid = options?.kid ?? TOKEN_DEFAULT_KID;
  if (parsed.header.kid !== kid) {
    return null;
  }

  const expected = sign(parsed.signingInput, secret);
  if (parsed.signature !== expected || isExpired(parsed.claims.exp)) {
    return null;
  }

  return parsed.claims;
}

export async function createManagedToken(claims: Omit<TokenClaims, "jti">): Promise<{ token: string; jti: string; kid: string }> {
  const key = await ensureActiveSigningKeyRecord();
  const fullClaims: TokenClaims = {
    ...claims,
    jti: randomUUID()
  };

  return {
    token: createToken(fullClaims, { secret: key.secret, kid: key.kid }),
    jti: fullClaims.jti,
    kid: key.kid
  };
}

export async function verifyManagedToken(token: string): Promise<TokenClaims | null> {
  const parsed = parseToken(token);
  if (!parsed) {
    return null;
  }

  const key = await getSigningKeyByKid(parsed.header.kid);
  if (!key) {
    return null;
  }

  const expected = sign(parsed.signingInput, key.secret);
  if (parsed.signature !== expected || isExpired(parsed.claims.exp)) {
    return null;
  }

  return parsed.claims;
}

export async function revokeManagedToken(input: {
  token: string;
  tenantId: string;
  reason?: string;
}): Promise<{ jti: string; agentId: string; expiresAt: Date } | null> {
  const claims = await verifyManagedToken(input.token);
  if (!claims) {
    return null;
  }

  if (claims.tenantId !== input.tenantId) {
    return null;
  }

  const expiresAt = new Date(claims.exp * 1000);
  await revokeToken({
    jti: claims.jti,
    tenantId: claims.tenantId,
    agentId: claims.sub,
    expiresAt,
    reason: input.reason
  });

  return {
    jti: claims.jti,
    agentId: claims.sub,
    expiresAt
  };
}

export async function isManagedTokenRevoked(jti: string): Promise<boolean> {
  const revoked = await getRevokedTokenByJti(jti);
  if (!revoked) {
    return false;
  }

  return revoked.expiresAt.getTime() > Date.now();
}

export async function getManagedTokenKeyId(token: string): Promise<string | null> {
  const parsed = parseToken(token);
  return parsed?.header.kid ?? null;
}

export async function getActiveManagedSigningKeyId(): Promise<string> {
  const key = await ensureActiveSigningKeyRecord();
  return key.kid;
}

export async function rotateManagedSigningKey(input: {
  kid: string;
  secret: string;
  activate: boolean;
}): Promise<void> {
  const existing = await getSigningKeyByKid(input.kid);
  if (existing) {
    if (input.activate) {
      await activateSigningKey(input.kid);
    }
    return;
  }

  await createSigningKey({
    kid: input.kid,
    secret: input.secret,
    activate: input.activate
  });
}

export function parseBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return null;
  }
  return auth.slice("Bearer ".length).trim();
}
