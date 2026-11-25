import { useTranslations } from 'next-intl';
import Link from 'next/link';
import s from '@/components/chalk/chalk.module.css';
import { ChalkRoom } from '@/components/chalk/ChalkRoom';
import { AppConfig } from '@/utils/AppConfig';
import { cn } from '@/utils/cn';

/**
 * Public pages: one big chalkboard. Brand and navigation are written at the top of the board,
 * the footer links sit on the wooden ledge.
 */
export const BaseTemplate = (props: {
  leftNav: React.ReactNode;
  rightNav?: React.ReactNode;
  ledge?: React.ReactNode;
  children: React.ReactNode;
}) => {
  const t = useTranslations('BaseTemplate');

  return (
    <ChalkRoom
      ledge={(
        <>
          <span className="mr-auto text-sm text-ink-wood">
            {`© ${new Date().getFullYear()} ${AppConfig.name} · Apache License 2.0`}
          </span>
          <a
            href="https://github.com/trungtv/bkquiz"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(s.btn, s.ledgeBtn)}
          >
            GitHub
          </a>
          <a
            href="https://github.com/trungtv/bkquiz/issues"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(s.btn, s.ledgeBtn)}
          >
            Report Issue
          </a>
          {props.ledge}
        </>
      )}
    >
      <header className={s.header}>
        <div className="min-w-0">
          <Link href="/" className={cn(s.script, s.chalk, 'text-3xl font-bold md:text-4xl')}>
            {AppConfig.name}
          </Link>
          <p className={cn(s.dim, 'hidden sm:block')}>{t('description')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Main navigation" className="hidden md:block">
            <ul className="flex flex-wrap items-center gap-1">
              {props.leftNav}
            </ul>
          </nav>

          <nav aria-label="Secondary navigation">
            <ul className="flex flex-wrap items-center gap-2">
              {props.rightNav}
            </ul>
          </nav>
        </div>
      </header>

      <div className={s.rule} />

      <main className="mx-auto w-full max-w-6xl py-2">{props.children}</main>
    </ChalkRoom>
  );
};
