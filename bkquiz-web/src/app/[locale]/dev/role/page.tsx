import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import s from '@/components/chalk/chalk.module.css';
import { cn } from '@/utils/cn';

export default async function DevRolePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <div className={cn(s.room, 'items-center')}>
      <div className={s.modal}>
        <div className={s.modalBoard}>
          <h1 className={cn(s.modalTitle, s.chalk)}>DEV: Chọn role để test</h1>
          <p className={s.modalText}>
            Chỉ dùng khi
            {' '}
            <span className="font-mono">DEV_BYPASS_AUTH=1</span>
            . Role được lưu bằng cookie.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href={`/api/dev/role?role=teacher&next=/${locale}/dashboard`}
              className={cn(s.btn, s.solidBtn)}
            >
              Teacher
            </Link>
            <Link
              href={`/api/dev/role?role=student&next=/${locale}/dashboard`}
              className={cn(s.btn, s.btnLg)}
            >
              Student
            </Link>
          </div>
          <p className={s.inputHint}>
            Tip: đổi role nhanh bằng cách quay lại trang này.
          </p>
        </div>
      </div>
    </div>
  );
}
