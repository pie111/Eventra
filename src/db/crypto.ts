// ─── Encryption Utility ───────────────────────────────────────
// AES-256-GCM encryption/decryption for sensitive data (API keys).
// Uses Node.js built-in crypto module — no external dependencies.

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, type BinaryLike } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT = "eventra-salt-v1"; // Static salt — the ENCRYPTION_KEY itself provides entropy

/**
 * Derives a 32-byte key from the user-provided ENCRYPTION_KEY env var.
 */
function deriveKey(secret: string): Buffer {
    return scryptSync(secret, SALT, KEY_LENGTH);
}

/**
 * Get the encryption key from the environment.
 * Throws if not set.
 */
function getKey(): Buffer {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) {
        throw new Error(
            "ENCRYPTION_KEY environment variable is required for storing API keys. " +
            "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
        );
    }
    return deriveKey(secret);
}

/**
 * Encrypt a plaintext string.
 * Returns format: `iv:authTag:ciphertext` (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt a previously encrypted string.
 * Expects format: `iv:authTag:ciphertext` (all hex-encoded).
 */
export function decrypt(encryptedData: string): string {
    const key = getKey();
    const [ivHex, authTagHex, ciphertext] = encryptedData.split(":");

    if (!ivHex || !authTagHex || !ciphertext) {
        throw new Error("Invalid encrypted data format. Expected iv:authTag:ciphertext");
    }

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}
