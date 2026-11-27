import { describe, expect, it } from 'vitest';
import { parseTrueFalseAnswer, trueFalseOptions } from '@/utils/trueFalse';
import { generatePoolMarkdown } from '../export/markdownPool';
import { parsePoolMarkdown } from './markdownPool';

const HEADER = '---\npool:\n  name: "Test"\n---\n';
const q = (prompt: string, answer: string) => `\n# QUESTION:\n${prompt}\n## TAGS: ["t"]\n## ANSWER:\n${answer}\n`;

describe('parseTrueFalseAnswer', () => {
  it.each([
    ['Đúng', true, 'Đúng'],
    ['sai', false, 'Đúng'],
    ['Đáp án: Đúng.', true, 'Đúng'],
    ['dap an: sai', false, 'Đúng'],
    ['TRUE', true, 'True'],
    ['Answer: false', false, 'True'],
  ])('%s → %s', (text, answer, trueLabel) => {
    expect(parseTrueFalseAnswer(text)).toMatchObject({ answer, labels: [trueLabel, expect.any(String)] });
  });

  it('anything else is not a true/false answer', () => {
    expect(parseTrueFalseAnswer('(x) Đúng')).toBeNull();
    expect(parseTrueFalseAnswer('Có thể')).toBeNull();
    expect(parseTrueFalseAnswer('')).toBeNull();
  });

  it('options: "true" option first, exactly one correct', () => {
    expect(trueFalseOptions(false)).toEqual([
      { content: 'Đúng', isCorrect: false, order: 0 },
      { content: 'Sai', isCorrect: true, order: 1 },
    ]);
  });
});

describe('parsePoolMarkdown — câu Đúng/Sai', () => {
  it('short answer becomes an mcq_single with 2 options (vi and en)', () => {
    const r = parsePoolMarkdown(HEADER + q('Trái Đất quay quanh Mặt Trời.', 'Đáp án: Đúng') + q('2 + 2 = 5', 'Answer: False'));

    expect(r.warnings).toEqual([]);
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0]).toMatchObject({ type: 'mcq_single', prompt: 'Trái Đất quay quanh Mặt Trời.', tags: ['t'] });
    expect(r.questions[0]!.options.map(o => [o.content, o.isCorrect])).toEqual([['Đúng', true], ['Sai', false]]);
    expect(r.questions[1]!.options.map(o => [o.content, o.isCorrect])).toEqual([['True', false], ['False', true]]);
  });

  it('answer on the same line as ## ANSWER: works too', () => {
    const r = parsePoolMarkdown(`${HEADER}\n# QUESTION:\nNước sôi ở 100°C (1 atm).\n## TAGS: ["t"]\n## ANSWER: Đúng\n`);

    expect(r.questions[0]!.options.find(o => o.isCorrect)?.content).toBe('Đúng');
  });

  it('an unrecognised one-line answer is skipped with a warning', () => {
    const r = parsePoolMarkdown(HEADER + q('Câu thiếu đáp án', 'Có thể'));

    expect(r.questions).toHaveLength(0);
    expect(r.warnings).toHaveLength(1);
  });

  it('regular multiple-choice questions still parse', () => {
    const r = parsePoolMarkdown(HEADER + q('1 + 1 = ?', '( ) 1\n(x) 2') + q('Chọn số chẵn', '[x] 2\n[ ] 3\n[x] 4'));

    expect(r.questions.map(x => [x.type, x.options.filter(o => o.isCorrect).length])).toEqual([['mcq_single', 1], ['mcq_multi', 2]]);
  });
});

describe('parsePoolMarkdown — xuất rồi nhập lại', () => {
  const pool = {
    name: 'Vòng tròn',
    visibility: 'private' as const,
    questions: [
      { type: 'mcq_single' as const, prompt: 'Câu đầu tiên', options: [{ content: 'A', isCorrect: true, order: 0 }, { content: 'B', isCorrect: false, order: 1 }], tags: [{ name: 't1' }] },
      { type: 'mcq_single' as const, prompt: 'Câu Đúng/Sai', options: trueFalseOptions(true), tags: [{ name: 't2' }] },
      { type: 'mcq_multi' as const, prompt: 'Câu nhiều đáp án', options: [{ content: 'X', isCorrect: true, order: 0 }, { content: 'Y', isCorrect: true, order: 1 }, { content: 'Z', isCorrect: false, order: 2 }], tags: [] },
    ],
  };

  it('round-trips every question, including the first one (prompt has no "# QUESTION:" prefix)', () => {
    const r = parsePoolMarkdown(generatePoolMarkdown(pool));

    expect(r.warnings).toEqual([]);
    expect(r.questions.map(x => x.prompt)).toEqual(['Câu đầu tiên', 'Câu Đúng/Sai', 'Câu nhiều đáp án']);
    expect(r.questions.map(x => x.type)).toEqual(['mcq_single', 'mcq_single', 'mcq_multi']);
    expect(r.questions[1]!.options.map(o => [o.content, o.isCorrect])).toEqual([['Đúng', true], ['Sai', false]]);
  });

  it('accepts Windows line endings', () => {
    const r = parsePoolMarkdown(generatePoolMarkdown(pool).replace(/\n/g, '\r\n'));

    expect(r.questions.map(x => x.prompt)).toEqual(['Câu đầu tiên', 'Câu Đúng/Sai', 'Câu nhiều đáp án']);
  });
});

describe('docs/cau-hoi-mau.md', () => {
  it('sample file imports all 52 questions, the last 2 as true/false', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const r = parsePoolMarkdown(readFileSync(resolve(__dirname, '../../../../docs/cau-hoi-mau.md'), 'utf8'));

    expect(r.warnings).toEqual([]);
    expect(r.questions).toHaveLength(52);
    expect(r.questions.slice(-2).map(x => x.options.map(o => `${o.isCorrect ? 'x' : ' '}${o.content}`))).toEqual([['xĐúng', ' Sai'], [' Đúng', 'xSai']]);
  });
});
