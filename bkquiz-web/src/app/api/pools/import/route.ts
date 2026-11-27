import JSZip from 'jszip';
import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { requireTeacher, requireUser } from '@/server/authz';
import { checkAuthz } from '@/server/authzHelpers';
import { extractQuestionsMdFromZip, parsePoolMarkdown } from '@/server/import/markdownPool';
import { collectAssetRefs, questionsMdPath, rewriteAssetRefs, uploadZipAssets } from '@/server/import/zipAssets';
import { prisma } from '@/server/prisma';
import { enforceRateLimit } from '@/server/rateLimit';
import { storageConfig } from '@/server/storage';
import { normalizeTagName } from '@/utils/tags';

export const runtime = 'nodejs';
export const maxDuration = 10; // Vercel Hobby limit: 10 seconds

export async function POST(req: Request) {
  try {
    const { userId, devRole } = await requireUser();
    const limited = await enforceRateLimit('poolImport', `user:${userId}`);
    if (limited) {
      return limited;
    }
    const roleDenied = await checkAuthz(() => requireTeacher(userId, devRole as 'teacher' | 'student' | undefined));
    if (roleDenied) {
      return roleDenied;
    }
    const form = await req.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'MISSING_FILE' }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    let md: string;
    // Ảnh trong file .zip (thư mục assets/): tải lên kho ảnh rồi thay đường dẫn tương đối bằng URL công khai
    let uploadedImages = 0;
    const assetWarnings: string[] = [];

    if (filename.endsWith('.zip')) {
      const buf = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      md = await extractQuestionsMdFromZip(zip);
      const refs = collectAssetRefs(md.replace(/\r\n/g, '\n'));
      if (refs.length > 0) {
        const config = storageConfig();
        if (!config) {
          assetWarnings.push('Chưa cấu hình kho ảnh (S3_*): ảnh trong file zip không được tải lên.');
        } else {
          const result = await uploadZipAssets(zip, refs, { userId, config, mdPath: questionsMdPath(zip) });
          md = rewriteAssetRefs(md.replace(/\r\n/g, '\n'), result.map);
          uploadedImages = result.map.size;
          assetWarnings.push(...result.warnings);
        }
      }
    } else if (filename.endsWith('.md')) {
      md = await file.text();
    } else {
      return NextResponse.json({ error: 'UNSUPPORTED_FILE' }, { status: 400 });
    }

    if (!md || md.trim().length === 0) {
      return NextResponse.json({ error: 'EMPTY_FILE' }, { status: 400 });
    }

    let parsed;
    try {
      parsed = parsePoolMarkdown(md);
    } catch (parseError) {
      const msg = parseError instanceof Error ? parseError.message : String(parseError);
      const stack = parseError instanceof Error ? parseError.stack : undefined;
      console.error('Parse error:', { msg, stack, mdPreview: md.substring(0, 500) });
      return NextResponse.json({ error: 'PARSE_ERROR', message: msg }, { status: 400 });
    }

    // Check if poolId is provided (for updating existing pool)
    const poolIdParam = form.get('poolId');
    let pool;
    let wasExisting = false;

    if (poolIdParam && typeof poolIdParam === 'string') {
      // Import into existing pool
      const existing = await prisma.questionPool.findUnique({
        where: { id: poolIdParam },
        select: { id: true, ownerTeacherId: true },
      });

      if (!existing) {
        return NextResponse.json({ error: 'POOL_NOT_FOUND' }, { status: 404 });
      }

      if (existing.ownerTeacherId !== userId) {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
      }

      wasExisting = true;

      // Update pool metadata
      pool = await prisma.questionPool.update({
        where: { id: poolIdParam },
        data: { visibility: parsed.visibility },
      });

      // Delete all existing questions in this pool (soft delete)
      await prisma.question.updateMany({
        where: { poolId: poolIdParam, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    } else {
      // Create new pool or find existing by name
      const existing = await prisma.questionPool.findFirst({
        where: { ownerTeacherId: userId, name: parsed.poolName },
        select: { id: true },
      });

      wasExisting = !!existing;

      pool = existing
        ? await prisma.questionPool.update({
            where: { id: existing.id },
            data: { visibility: parsed.visibility },
          })
        : await prisma.questionPool.create({
            data: {
              id: nanoid(),
              name: parsed.poolName,
              visibility: parsed.visibility,
              ownerTeacherId: userId,
              updatedAt: new Date(),
            },
          });
    }

    // ✅ OPTIMIZED: Batch operations để tránh timeout
    // Step 1: Collect all unique tags first
    const uniqueTagNames = new Set<string>();
    for (const q of parsed.questions) {
      for (const tagName of q.tags) {
        uniqueTagNames.add(tagName.trim());
      }
    }

    // Step 2: Upsert all tags in batch
    const tagMap = new Map<string, string>(); // normalizedName -> tagId
    let createdTags = 0;

    for (const tagName of uniqueTagNames) {
      const normalizedName = normalizeTagName(tagName);
      const before = await prisma.tag.findUnique({ where: { normalizedName }, select: { id: true } });
      const tag = await prisma.tag.upsert({
        where: { normalizedName },
        update: { name: tagName },
        create: { name: tagName, normalizedName },
        select: { id: true },
      });
      tagMap.set(normalizedName, tag.id);
      if (!before) {
        createdTags += 1;
      }
    }

    // Step 3: Create all questions with nested options (Prisma supports nested create)
    // Use transaction để đảm bảo atomicity và performance tốt hơn
    const questions = await prisma.$transaction(
      parsed.questions.map(q =>
        prisma.question.create({
          data: {
            id: nanoid(),
            poolId: pool.id,
            type: q.type,
            prompt: q.prompt,
            imageUrl: q.image?.url ?? null,
            imageAlt: q.image ? q.image.alt : null,
            createdByTeacherId: userId,
            updatedAt: new Date(),
            options: {
              create: q.options.map(o => ({
                id: nanoid(),
                content: o.content,
                isCorrect: o.isCorrect,
                order: o.order,
                updatedAt: new Date(),
              })),
            },
          },
          select: { id: true },
        }),
      ),
    );

    const importedQuestions = questions.length;

    // Step 4: Create all questionTags in batch
    const questionTags: Array<{ questionId: string; tagId: string }> = [];
    for (let i = 0; i < parsed.questions.length; i++) {
      const q = parsed.questions[i];
      const question = questions[i];
      if (!q || !question) {
        continue;
      }
      const questionId = question.id;
      for (const tagName of q.tags) {
        const normalizedName = normalizeTagName(tagName);
        const tagId = tagMap.get(normalizedName);
        if (tagId) {
          questionTags.push({ questionId, tagId });
        }
      }
    }

    // Batch create questionTags (skip duplicates)
    if (questionTags.length > 0) {
      // Prisma createMany doesn't support skipDuplicates for composite keys,
      // so we use Promise.all with catch for duplicates
      await Promise.all(
        questionTags.map(qt =>
          prisma.questionTag.create({
            data: qt,
          }).catch(() => null), // Ignore duplicate errors
        ),
      );
    }

    return NextResponse.json({
      poolId: pool.id,
      createdPool: !wasExisting,
      createdTags,
      importedQuestions,
      skippedQuestions: parsed.warnings.length,
      warnings: parsed.warnings,
      uploadedImages,
      // Cảnh báo về ảnh tách riêng để `skippedQuestions` vẫn là số câu bị bỏ qua
      assetWarnings,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: 'IMPORT_EXCEPTION', message: msg }, { status: 500 });
  }
}
