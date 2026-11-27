import { cn } from '@/utils/cn';

/**
 * Ảnh minh hoạ của câu hỏi — khung "giấy" giống ô QR trên màn chiếu (dễ nhìn trên nền bảng đen),
 * giữ tỉ lệ, giới hạn chiều cao. Dùng `<img>` thường (không `next/image`) vì ảnh có thể ở MinIO, Supabase
 * hoặc URL ngoài; `referrerPolicy="no-referrer"` để không lộ địa chỉ trang làm bài cho máy chủ ảnh.
 */
export function QuestionImage(props: { url?: string | null; alt?: string | null; className?: string; size?: 'sm' | 'md' }) {
  if (!props.url) {
    return null;
  }
  return (
    <figure
      className={cn(
        'w-fit max-w-full rounded-[10px] border-4 border-wood bg-paper p-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]',
        props.className,
      )}
    >
      {/* eslint-disable-next-line next/no-img-element -- ảnh từ nhiều nguồn (MinIO / Supabase / URL ngoài), xem chú thích trên */}
      <img
        src={props.url}
        alt={props.alt ?? ''}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn('block h-auto w-auto max-w-full object-contain', props.size === 'sm' ? 'max-h-40' : 'max-h-72')}
      />
    </figure>
  );
}
