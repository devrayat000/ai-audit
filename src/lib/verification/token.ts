import crypto from "node:crypto";

function getSecret(): string {
  return process.env.VERIFICATION_SECRET || "dev-only-insecure-secret-change-me";
}

/**
 * Returns true when domain ownership verification should be bypassed:
 *  - NODE_ENV is anything other than "production" (dev / test runs), OR
 *  - ALLOW_REGEN_WITHOUT_VERIFICATION=true is explicitly set.
 *
 * Production deployments require real verification.
 */
export function isVerificationBypassed(): boolean {
  if (process.env.ALLOW_REGEN_WITHOUT_VERIFICATION === "true") return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf) : buf;
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export interface VerificationToken {
  domain: string;
  token: string;
  randomPart: string;
  issuedAt: number;
  expiresAt: number;
}

export function issueVerificationToken(domain: string): VerificationToken {
  const random = crypto.randomBytes(12);
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 24 * 60 * 60 * 1000;
  const payload = `${domain.toLowerCase()}.${issuedAt}.${expiresAt}.${b64url(random)}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest();
  const token = `${b64url(payload)}.${b64url(sig)}`;
  return { domain, token, randomPart: b64url(random), issuedAt, expiresAt };
}

export function parseToken(token: string): { domain: string; issuedAt: number; expiresAt: number; valid: boolean } {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return invalid();
    const payload = fromB64Url(payloadB64).toString("utf8");
    const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest();
    const sig = fromB64Url(sigB64);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return invalid();
    const [domain, issuedAtStr, expiresAtStr] = payload.split(".");
    const issuedAt = Number(issuedAtStr);
    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt)) return invalid();
    return { domain, issuedAt, expiresAt, valid: true };
  } catch {
    return invalid();
  }
}

function invalid() {
  return { domain: "", issuedAt: 0, expiresAt: 0, valid: false };
}

export interface VerifiedProof {
  domain: string;
  method: "dns-txt" | "meta-tag";
  verifiedAt: number;
  expiresAt: number;
  proof: string;
}

export function signVerifiedProof(domain: string, method: "dns-txt" | "meta-tag"): VerifiedProof {
  const verifiedAt = Date.now();
  const expiresAt = verifiedAt + 24 * 60 * 60 * 1000;
  const payload = `verified.${domain.toLowerCase()}.${method}.${verifiedAt}.${expiresAt}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest();
  const proof = `${b64url(payload)}.${b64url(sig)}`;
  return { domain, method, verifiedAt, expiresAt, proof };
}

export function verifyProof(proof: string, expectedDomain: string): { valid: boolean; method?: "dns-txt" | "meta-tag"; expiresAt?: number; reason?: string } {
  try {
    const [payloadB64, sigB64] = proof.split(".");
    if (!payloadB64 || !sigB64) return { valid: false, reason: "Malformed proof" };
    const payload = fromB64Url(payloadB64).toString("utf8");
    const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest();
    const sig = fromB64Url(sigB64);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) {
      return { valid: false, reason: "Invalid signature" };
    }
    const [tag, domain, method, , expiresAtStr] = payload.split(".");
    if (tag !== "verified") return { valid: false, reason: "Wrong proof tag" };
    if (domain !== expectedDomain.toLowerCase()) return { valid: false, reason: "Domain mismatch" };
    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
      return { valid: false, reason: "Proof expired" };
    }
    return { valid: true, method: method as "dns-txt" | "meta-tag", expiresAt };
  } catch {
    return { valid: false, reason: "Parse error" };
  }
}
