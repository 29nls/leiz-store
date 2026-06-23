import crypto from "node:crypto";

/**
 * S3-Compatible Storage Service
 * Works with AWS S3, Cloudflare R2, MinIO, and other S3-compatible providers
 */

interface StorageConfig {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
  publicUrl?: string;
}

interface UploadOptions {
  key: string;
  contentType: string;
  body: Buffer | Uint8Array;
  isPublic?: boolean;
  cacheControl?: string;
}

interface UploadResult {
  key: string;
  url: string;
  size: number;
}

function getConfig(): StorageConfig {
  return {
    endpoint: process.env.S3_ENDPOINT || "",
    bucket: process.env.S3_BUCKET || "",
    accessKey: process.env.S3_ACCESS_KEY || "",
    secretKey: process.env.S3_SECRET_KEY || "",
    region: process.env.S3_REGION || "auto",
    publicUrl: process.env.S3_PUBLIC_URL,
  };
}

function isConfigured(): boolean {
  const config = getConfig();
  return !!(config.endpoint && config.bucket && config.accessKey && config.secretKey);
}

/**
 * Generate a signed URL for S3 operations using AWS Signature V4
 */
function signRequest(
  config: StorageConfig,
  method: string,
  path: string,
  contentType?: string,
  date: Date = new Date()
): Record<string, string> {
  const timestamp = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = timestamp.substring(0, 8);

  const host = new URL(config.endpoint).host;
  const canonicalUri = `/${config.bucket}/${path}`;
  const canonicalQueryString = "";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const headers: Record<string, string> = {
    host,
    "x-amz-date": timestamp,
    "x-amz-content-sha256": payloadHash,
  };

  if (contentType) {
    headers["content-type"] = contentType;
  }

  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join("\n");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    "",
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    credentialScope,
    hashSHA256(canonicalRequest),
  ].join("\n");

  const parts = [dateStamp, config.region, "s3", "aws4_request"];
  let signingKey: Buffer = hmacSHA256("AWS4" + config.secretKey, parts[0]);
  for (let i = 1; i < parts.length; i++) {
    signingKey = hmacSHA256(signingKey, parts[i]);
  }

  const signature = hmacSHA256(signingKey, stringToSign);

  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature.toString("hex")}`,
  };
}

function hmacSHA256(key: string | Buffer, message: string): Buffer {
  return crypto
    .createHmac("sha256", key)
    .update(message)
    .digest();
}

function hashSHA256(message: string): string {
  return crypto.createHash("sha256").update(message).digest("hex");
}

/**
 * Upload a file to S3-compatible storage
 */
export async function uploadFile(options: UploadOptions): Promise<UploadResult> {
  if (!isConfigured()) {
    throw new Error("S3 storage not configured");
  }

  const config = getConfig();
  const url = `${config.endpoint}/${config.bucket}/${options.key}`;
  const headers = signRequest(config, "PUT", options.key, options.contentType);

  if (options.cacheControl) {
    headers["cache-control"] = options.cacheControl;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": options.contentType,
    },
    body: new Uint8Array(options.body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`S3 upload failed (${response.status}): ${text}`);
  }

  const publicUrl = config.publicUrl || `${config.endpoint}/${config.bucket}`;

  return {
    key: options.key,
    url: `${publicUrl}/${options.key}`,
    size: options.body.length,
  };
}

/**
 * Delete a file from S3-compatible storage
 */
export async function deleteFile(key: string): Promise<void> {
  if (!isConfigured()) {
    throw new Error("S3 storage not configured");
  }

  const config = getConfig();
  const url = `${config.endpoint}/${config.bucket}/${key}`;
  const headers = signRequest(config, "DELETE", key);

  const response = await fetch(url, {
    method: "DELETE",
    headers,
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`S3 delete failed (${response.status}): ${text}`);
  }
}

interface PresignedPostFields {
  url: string;
  fields: Record<string, string>;
  expiresAt: number;
}

/**
 * Generate a presigned POST policy for direct client upload to S3.
 * The policy restricts: bucket, key, content-type, and expiration.
 * Returns the S3 endpoint URL + signed form fields the client POSTs to.
 */
export function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): PresignedPostFields {
  if (!isConfigured()) {
    throw new Error("S3 storage not configured");
  }

  const config = getConfig();
  const date = new Date();
  const timestamp = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = timestamp.substring(0, 8);
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const expiration = Math.floor(date.getTime() / 1000) + expiresIn;

  // Build the CORS-compatible POST policy
  const policy = {
    expiration: new Date(expiration * 1000).toISOString(),
    conditions: [
      { bucket: config.bucket },
      ["starts-with", "$key", key],
      { "Content-Type": contentType },
      { "x-amz-algorithm": "AWS4-HMAC-SHA256" },
      { "x-amz-credential": `${config.accessKey}/${credentialScope}` },
      { "x-amz-date": timestamp },
    ],
  };

  // Base64-encode the policy
  const policyBase64 = Buffer.from(JSON.stringify(policy)).toString("base64");

  // Sign the policy with AWS Sig V4
  const signingKey = [dateStamp, config.region, "s3", "aws4_request"]
    .reduce<Buffer>((k, p) => hmacSHA256(k, p), hmacSHA256("AWS4" + config.secretKey, dateStamp));
  const signature = hmacSHA256(signingKey, policyBase64).toString("hex");

  const endpoint = `${config.endpoint}/${config.bucket}`;

  return {
    url: endpoint,
    expiresAt: expiration,
    fields: {
      key,
      "Content-Type": contentType,
      Policy: policyBase64,
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${config.accessKey}/${credentialScope}`,
      "X-Amz-Date": timestamp,
      "X-Amz-Signature": signature,
    },
  };
}

/**
 * Generate a product image key
 */
export function generateProductImageKey(
  productId: string,
  filename: string,
  index: number
): string {
  const lastDot = filename.lastIndexOf(".");
  const ext = lastDot >= 0 ? filename.substring(lastDot + 1) : "jpg";
  const base = lastDot >= 0 ? filename.substring(0, lastDot) : filename;
  const safeName = base
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "-")
    .replace(/-+/g, "-");
  return `products/${productId}/${index}-${safeName}.${ext}`;
}

export const storageService = {
  isConfigured,
  uploadFile,
  deleteFile,
  getPresignedUploadUrl,
  generateProductImageKey,
};