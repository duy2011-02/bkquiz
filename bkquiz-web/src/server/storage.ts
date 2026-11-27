import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Lưu ảnh câu hỏi lên kho tương thích S3: MinIO khi chạy local (docker compose), Supabase Storage khi deploy.
 * Ảnh được đọc công khai qua `S3_PUBLIC_BASE_URL` (mặc định `<S3_ENDPOINT>/<S3_BUCKET>`, kiểu path-style của MinIO).
 */

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type ImageType = { ext: 'png' | 'jpg' | 'webp'; contentType: 'image/png' | 'image/jpeg' | 'image/webp' };

/** Nhận dạng ảnh theo nội dung (magic bytes), không tin `Content-Type` do trình duyệt khai. */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  const at = (i: number) => bytes[i];
  if (bytes.length >= 8 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4E && at(3) === 0x47 && at(4) === 0x0D && at(5) === 0x0A && at(6) === 0x1A && at(7) === 0x0A) {
    return { ext: 'png', contentType: 'image/png' };
  }
  if (bytes.length >= 3 && at(0) === 0xFF && at(1) === 0xD8 && at(2) === 0xFF) {
    return { ext: 'jpg', contentType: 'image/jpeg' };
  }
  // RIFF....WEBP
  if (bytes.length >= 12 && at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46
    && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  return null;
}

export type ImageCheck
  = | { ok: true; type: ImageType }
    | { ok: false; error: 'EMPTY_FILE' | 'FILE_TOO_LARGE' | 'UNSUPPORTED_IMAGE' };

/** PNG / JPEG / WebP, tối đa 2 MB. */
export function validateImageUpload(size: number, head: Uint8Array): ImageCheck {
  if (size <= 0) {
    return { ok: false, error: 'EMPTY_FILE' };
  }
  if (size > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'FILE_TOO_LARGE' };
  }
  const type = detectImageType(head);
  return type ? { ok: true, type } : { ok: false, error: 'UNSUPPORTED_IMAGE' };
}

export type StorageConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

/** Đọc cấu hình từ env; thiếu biến nào thì trả `null` (API upload báo `STORAGE_NOT_CONFIGURED`). */
export function storageConfig(env: Record<string, string | undefined> = process.env): StorageConfig | null {
  const endpoint = env.S3_ENDPOINT?.trim().replace(/\/+$/, '');
  const bucket = env.S3_BUCKET?.trim();
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }
  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: env.S3_REGION?.trim() || 'us-east-1',
    publicBaseUrl: (env.S3_PUBLIC_BASE_URL?.trim() || `${endpoint}/${bucket}`).replace(/\/+$/, ''),
  };
}

export function publicUrlFor(config: StorageConfig, key: string) {
  return `${config.publicBaseUrl}/${key}`;
}

let client: { key: string; s3: S3Client } | null = null;

function s3For(config: StorageConfig) {
  const key = `${config.endpoint}|${config.accessKeyId}|${config.region}`;
  if (!client || client.key !== key) {
    client = {
      key,
      s3: new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: true, // MinIO và Supabase Storage đều dùng path-style
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      }),
    };
  }
  return client.s3;
}

export async function putPublicObject(config: StorageConfig, key: string, body: Uint8Array, contentType: string) {
  await s3For(config).send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable', // key ngẫu nhiên, nội dung không bao giờ đổi
  }));
  return publicUrlFor(config, key);
}
