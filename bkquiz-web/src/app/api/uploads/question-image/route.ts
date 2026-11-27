import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { requireTeacher, requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { enforceRateLimit } from '@/server/rateLimit';
import { MAX_IMAGE_BYTES, putPublicObject, storageConfig, validateImageUpload } from '@/server/storage';

/**
 * Upload ảnh minh hoạ cho câu hỏi (multipart, trường `file`). Server nhận file rồi đưa lên S3 (MinIO / Supabase Storage):
 * - kiểm tra loại theo nội dung (PNG / JPEG / WebP), không tin Content-Type của trình duyệt; tối đa 2 MB;
 * - key ngẫu nhiên `questions/<userId>/<id>.<ext>` → trả `{ url }` công khai để gắn vào câu hỏi.
 * Không dùng presigned URL để khỏi cấu hình CORS trên bucket và để kiểm tra được nội dung file.
 */
export async function POST(req: Request) {
  try {
    const { userId, devRole } = await requireUser();
    const limited = await enforceRateLimit('imageUpload', `user:${userId}`);
    if (limited) {
      return limited;
    }
    await requireTeacher(userId, devRole as 'teacher' | 'student' | undefined);

    const config = storageConfig();
    if (!config) {
      return NextResponse.json({ error: 'STORAGE_NOT_CONFIGURED' }, { status: 503 });
    }

    // Chặn sớm theo Content-Length (multipart có thêm vài trăm byte phần đầu)
    const declared = Number(req.headers.get('content-length') ?? 0);
    if (declared > MAX_IMAGE_BYTES + 64 * 1024) {
      return NextResponse.json({ error: 'FILE_TOO_LARGE', maxBytes: MAX_IMAGE_BYTES }, { status: 413 });
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'MISSING_FILE' }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'FILE_TOO_LARGE', maxBytes: MAX_IMAGE_BYTES }, { status: 413 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const check = validateImageUpload(bytes.length, bytes.subarray(0, 16));
    if (!check.ok) {
      return NextResponse.json({ error: check.error, maxBytes: MAX_IMAGE_BYTES }, { status: check.error === 'FILE_TOO_LARGE' ? 413 : 400 });
    }

    const key = `questions/${userId}/${nanoid()}.${check.type.ext}`;
    try {
      const url = await putPublicObject(config, key, bytes, check.type.contentType);
      return NextResponse.json({ url }, { status: 201 });
    } catch (error) {
      console.error('Question image upload failed', error);
      return NextResponse.json({ error: 'STORAGE_UNAVAILABLE' }, { status: 502 });
    }
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}
