import { NextResponse } from 'next/server';
import { AuthorizationError } from './authz';

/**
 * Helper function to handle authorization errors in API routes
 * Returns appropriate NextResponse based on error type
 */
export function handleAuthorizationError(error: unknown): NextResponse | null {
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: error.code },
      { status: error.statusCode },
    );
  }
  return null;
}

/**
 * Chạy một kiểm tra quyền (requireTeacher, requireStudent…): lỗi phân quyền → NextResponse (403 / 404) để route
 * trả về ngay; lỗi khác ném tiếp. Dùng ở các route gọi kiểm tra quyền ngoài khối try — trước đây lỗi phân quyền
 * ở đó thành 500.
 */
export async function checkAuthz(check: () => Promise<unknown>): Promise<NextResponse | null> {
  try {
    await check();
    return null;
  } catch (error) {
    const response = handleAuthorizationError(error);
    if (response) {
      return response;
    }
    throw error;
  }
}

/**
 * Wrapper for API route handlers to catch and handle authorization errors
 * Usage:
 * ```ts
 * export async function GET(req: Request) {
 *   return withAuthz(async () => {
 *     const { userId } = await requireUser();
 *     await requireTeacher(userId);
 *     // ... rest of handler
 *     return NextResponse.json({ data: ... });
 *   });
 * }
 * ```
 */
export async function withAuthz<T extends NextResponse>(
  handler: () => Promise<T>,
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    // Re-throw if not an authorization error
    throw error;
  }
}
