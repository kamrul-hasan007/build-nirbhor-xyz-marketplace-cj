import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

const context = Buffer.from('nirbhor-provider-payout:v1')

type EncryptedValue = { version: 1; iv: string; ciphertext: string; tag: string }

function encryptionKey() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error('Provider payout encryption is unavailable.')
  return Buffer.from(hkdfSync('sha256', secret, Buffer.alloc(0), context, 32))
}

export function encryptProviderPayout<T>(value: T): EncryptedValue {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return { version: 1, iv: iv.toString('base64url'), ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') }
}

export function decryptProviderPayout<T>(value: unknown): T | null {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('iv' in value) || !('ciphertext' in value) || !('tag' in value)) return null
  try {
    const encrypted = value as EncryptedValue
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(encrypted.iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64url'))
    const plaintext = Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, 'base64url')), decipher.final()]).toString('utf8')
    return JSON.parse(plaintext) as T
  } catch {
    return null
  }
}
