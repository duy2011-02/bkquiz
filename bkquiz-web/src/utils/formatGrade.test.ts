import { describe, expect, it } from 'vitest';
import { formatGrade, questionPointsOnTenScale } from './formatGrade';

describe('formatGrade', () => {
  it('drops trailing zeros and keeps at most 2 decimals', () => {
    expect(formatGrade(10)).toBe('10');
    expect(formatGrade(7.5)).toBe('7.5');
    expect(formatGrade(6.666)).toBe('6.67');
    expect(formatGrade(0)).toBe('0');
  });
});

describe('questionPointsOnTenScale', () => {
  it('one question is worth 10 / question count', () => {
    expect(questionPointsOnTenScale(1, 5)).toBe(2);
    expect(questionPointsOnTenScale(1, 20)).toBe(0.5);
    expect(questionPointsOnTenScale(0.5, 5)).toBe(1); // điểm một phần
    expect(formatGrade(questionPointsOnTenScale(1, 3))).toBe('3.33');
    expect(questionPointsOnTenScale(1, 0)).toBe(0);
  });
});
