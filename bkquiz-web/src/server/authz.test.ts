import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  quizSession: { findUnique: vi.fn() },
  classMembership: { findUnique: vi.fn() },
  attempt: { findUnique: vi.fn() },
  classroom: { findUnique: vi.fn() },
  quiz: { findUnique: vi.fn() },
  questionPool: { findUnique: vi.fn() },
  userRole: { findMany: vi.fn() },
}));

vi.mock('@/server/prisma', () => ({ prisma: db }));
vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));

const {
  AuthorizationError,
  getUserRole,
  requireAttemptAccess,
  requireClassroomOwnership,
  requireQuizOwnership,
  requireSessionAccess,
  requireTeacher,
  requireTeacherInClassroom,
} = await import('./authz');

const SESSION = { id: 's1', classroomId: 'c1', quiz: { createdByTeacherId: 'owner' } };

function membership(roleInClass: 'teacher' | 'ta' | 'student', status: 'active' | 'left' | 'banned' = 'active') {
  return { roleInClass, status };
}

async function expectAuthzError(promise: Promise<unknown>, code: string, statusCode = 403) {
  const err = await promise.catch((e: unknown) => e);

  expect(err).toBeInstanceOf(AuthorizationError);
  expect(err).toMatchObject({ code, statusCode });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireSessionAccess', () => {
  beforeEach(() => {
    db.quizSession.findUnique.mockResolvedValue(SESSION);
  });

  it('quiz owner is a teacher of the session even without membership', async () => {
    db.classMembership.findUnique.mockResolvedValue(null);
    const r = await requireSessionAccess('owner', 's1', 'teacher');

    expect(r.userRole).toBe('teacher');
    expect(r.isQuizOwner).toBe(true);
  });

  it.each(['teacher', 'ta'] as const)('active %s in the classroom is a teacher of the session', async (role) => {
    db.classMembership.findUnique.mockResolvedValue(membership(role));

    await expect(requireSessionAccess('u2', 's1', 'teacher')).resolves.toMatchObject({ userRole: 'teacher' });
  });

  it('active student member gets the student role', async () => {
    db.classMembership.findUnique.mockResolvedValue(membership('student'));

    await expect(requireSessionAccess('stu', 's1', 'student')).resolves.toMatchObject({ userRole: 'student' });
  });

  it('student cannot use teacher-only session endpoints', async () => {
    db.classMembership.findUnique.mockResolvedValue(membership('student'));

    await expectAuthzError(requireSessionAccess('stu', 's1', 'teacher'), 'FORBIDDEN');
  });

  it('teacher cannot act as a student of the session', async () => {
    db.classMembership.findUnique.mockResolvedValue(membership('teacher'));

    await expectAuthzError(requireSessionAccess('t2', 's1', 'student'), 'FORBIDDEN');
  });

  it('outsider is rejected', async () => {
    db.classMembership.findUnique.mockResolvedValue(null);

    await expectAuthzError(requireSessionAccess('stranger', 's1'), 'FORBIDDEN');
  });

  it.each(['left', 'banned'] as const)('%s member is rejected', async (status) => {
    db.classMembership.findUnique.mockResolvedValue(membership('student', status));

    await expectAuthzError(requireSessionAccess('stu', 's1'), 'FORBIDDEN');
  });

  it('banned teacher-in-class loses teacher access', async () => {
    db.classMembership.findUnique.mockResolvedValue(membership('teacher', 'banned'));

    await expectAuthzError(requireSessionAccess('t2', 's1', 'teacher'), 'FORBIDDEN');
  });

  it('unknown session → 404', async () => {
    db.quizSession.findUnique.mockResolvedValue(null);

    await expectAuthzError(requireSessionAccess('owner', 'missing'), 'SESSION_NOT_FOUND', 404);
  });
});

describe('requireAttemptAccess', () => {
  it('owner of the attempt passes', async () => {
    db.attempt.findUnique.mockResolvedValue({ id: 'a1', userId: 'stu' });

    await expect(requireAttemptAccess('stu', 'a1')).resolves.toEqual({ id: 'a1', userId: 'stu' });
  });

  it('another user (even a teacher) is rejected', async () => {
    db.attempt.findUnique.mockResolvedValue({ id: 'a1', userId: 'stu' });

    await expectAuthzError(requireAttemptAccess('other', 'a1'), 'FORBIDDEN');
  });

  it('unknown attempt → 404', async () => {
    db.attempt.findUnique.mockResolvedValue(null);

    await expectAuthzError(requireAttemptAccess('stu', 'missing'), 'ATTEMPT_NOT_FOUND', 404);
  });
});

describe('requireTeacherInClassroom', () => {
  it('accepts active teacher and TA', async () => {
    db.classMembership.findUnique.mockResolvedValueOnce(membership('teacher'));

    await expect(requireTeacherInClassroom('t', 'c1')).resolves.toBeTruthy();

    db.classMembership.findUnique.mockResolvedValueOnce(membership('ta'));

    await expect(requireTeacherInClassroom('ta', 'c1')).resolves.toBeTruthy();
  });

  it('rejects students, non-members and inactive teachers', async () => {
    db.classMembership.findUnique.mockResolvedValueOnce(membership('student'));
    await expectAuthzError(requireTeacherInClassroom('stu', 'c1'), 'CLASSROOM_FORBIDDEN');

    db.classMembership.findUnique.mockResolvedValueOnce(null);
    await expectAuthzError(requireTeacherInClassroom('x', 'c1'), 'CLASSROOM_FORBIDDEN');

    db.classMembership.findUnique.mockResolvedValueOnce(membership('teacher', 'left'));
    await expectAuthzError(requireTeacherInClassroom('t', 'c1'), 'CLASSROOM_FORBIDDEN');
  });
});

describe('ownership checks', () => {
  it('classroom: owner passes, others 403, missing 404', async () => {
    db.classroom.findUnique.mockResolvedValue({ id: 'c1', ownerTeacherId: 'owner' });

    await expect(requireClassroomOwnership('owner', 'c1')).resolves.toMatchObject({ id: 'c1' });

    await expectAuthzError(requireClassroomOwnership('other', 'c1'), 'FORBIDDEN');

    db.classroom.findUnique.mockResolvedValue(null);
    await expectAuthzError(requireClassroomOwnership('owner', 'c1'), 'CLASSROOM_NOT_FOUND', 404);
  });

  it('quiz: only the creator passes', async () => {
    db.quiz.findUnique.mockResolvedValue({ id: 'q1', createdByTeacherId: 'owner' });

    await expect(requireQuizOwnership('owner', 'q1')).resolves.toMatchObject({ id: 'q1' });

    await expectAuthzError(requireQuizOwnership('other', 'q1'), 'FORBIDDEN');
  });
});

describe('system role', () => {
  it('dev role overrides the database', async () => {
    await expect(getUserRole('u', 'student')).resolves.toBe('student');

    expect(db.userRole.findMany).not.toHaveBeenCalled();
  });

  it('prefers teacher when the user has both roles', async () => {
    db.userRole.findMany.mockResolvedValue([{ role: 'student' }, { role: 'teacher' }]);

    await expect(getUserRole('u')).resolves.toBe('teacher');
  });

  it('requireTeacher rejects a student', async () => {
    db.userRole.findMany.mockResolvedValue([{ role: 'student' }]);

    await expectAuthzError(requireTeacher('u'), 'FORBIDDEN');
  });
});
