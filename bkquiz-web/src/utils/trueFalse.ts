/**
 * Câu Đúng/Sai: lưu như câu một đáp án (`mcq_single`) có đúng 2 phương án, phương án đầu là "Đúng".
 * Không thêm loại câu mới nên chấm điểm, snapshot đề, thống kê, import / export dùng chung với câu một đáp án.
 */

export type TrueFalseLabels = readonly [trueLabel: string, falseLabel: string];

export const TRUE_FALSE_LABELS_VI: TrueFalseLabels = ['Đúng', 'Sai'];
export const TRUE_FALSE_LABELS_EN: TrueFalseLabels = ['True', 'False'];

/** 2 phương án của câu Đúng/Sai: `answer` = true nghĩa là "Đúng" là đáp án đúng. */
export function trueFalseOptions(answer: boolean, labels: TrueFalseLabels = TRUE_FALSE_LABELS_VI) {
  return [
    { content: labels[0], isCorrect: answer, order: 0 },
    { content: labels[1], isCorrect: !answer, order: 1 },
  ];
}

const PREFIXES = ['đáp án:', 'dap an:', 'answer:'];

/**
 * Đáp án rút gọn trong file import: `Đúng` / `Sai` / `True` / `False`, có thể kèm `Đáp án:` / `Answer:` phía trước
 * (không phân biệt hoa thường, bỏ dấu chấm cuối). Nhãn phương án theo ngôn ngữ của từ đã viết.
 * Trả `null` nếu không phải đáp án Đúng/Sai.
 */
export function parseTrueFalseAnswer(text: string): { answer: boolean; labels: TrueFalseLabels } | null {
  let value = text.trim().toLowerCase();
  for (const prefix of PREFIXES) {
    if (value.startsWith(prefix)) {
      value = value.slice(prefix.length).trim();
      break;
    }
  }
  while (value.endsWith('.') || value.endsWith('!')) {
    value = value.slice(0, -1).trimEnd();
  }
  switch (value) {
    case 'đúng':
    case 'dung':
      return { answer: true, labels: TRUE_FALSE_LABELS_VI };
    case 'sai':
      return { answer: false, labels: TRUE_FALSE_LABELS_VI };
    case 'true':
      return { answer: true, labels: TRUE_FALSE_LABELS_EN };
    case 'false':
      return { answer: false, labels: TRUE_FALSE_LABELS_EN };
    default:
      return null;
  }
}
