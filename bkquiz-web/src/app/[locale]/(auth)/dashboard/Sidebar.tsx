'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useState } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { usePathname } from '@/libs/I18nNavigation';
import { AppConfig } from '@/utils/AppConfig';
import { cn } from '@/utils/cn';

type SidebarProps = {
  role: 'teacher' | 'student';
  availableRoles?: ('teacher' | 'student')[];
  dashboardLink: string;
  classesLink: string;
  quizzesLink: string;
  questionBankLink: string;
  userProfileLink: string;
  teacherRole: string;
  studentRole: string;
  mySessions: string;
  userProfile: string;
  collapseSidebar: string;
  expandSidebar: string;
  signOutLabel?: string;
};

type NavItem = { href: string; label: string; icon: ReactNode; active: boolean };

function Icon(props: { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

/**
 * Navigation written on the board, left of the content (the attempt page's .side, mirrored).
 * Desktop: a column separated by a dashed chalk line, collapsible to icons.
 * Mobile: a menu button that opens the same list in a small chalkboard drawer.
 */
export function Sidebar(props: SidebarProps) {
  const t = useTranslations('DashboardLayout');
  const locale = useLocale();
  // Pathname without the locale prefix
  const pathname = usePathname();
  // Always start expanded to match the server render (avoid hydration mismatch)
  const [isExpanded, setIsExpanded] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Load the saved collapse state before paint to minimise a flash
  useLayoutEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar-expanded');
      if (saved !== null) {
        setIsExpanded(saved === 'true');
      }
    } catch {
      // Ignore localStorage errors
    } finally {
      setHasLoaded(true);
    }
  }, []);

  useLayoutEffect(() => {
    if (hasLoaded) {
      try {
        localStorage.setItem('sidebar-expanded', String(isExpanded));
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [isExpanded, hasLoaded]);

  // Close the mobile drawer when the route changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setIsMobileOpen(false);
  }, [pathname]);

  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  const isTeacher = props.role === 'teacher';

  const items: NavItem[] = [
    {
      href: '/dashboard/',
      label: props.dashboardLink,
      active: pathname === '/dashboard' || pathname === '/dashboard/',
      icon: (
        <Icon>
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </Icon>
      ),
    },
    {
      href: '/dashboard/classes/',
      label: props.classesLink,
      active: isActive('/dashboard/classes'),
      icon: (
        <Icon>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </Icon>
      ),
    },
    ...(isTeacher
      ? [
          {
            href: '/dashboard/quizzes/',
            label: props.quizzesLink,
            active: isActive('/dashboard/quizzes'),
            icon: (
              <Icon>
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <path d="M10 10.3c.2-.4.5-.8.9-1a2.1 2.1 0 0 1 2.6.4c.3.2.5.5.6.9a2.1 2.1 0 0 1-1.5 2.5c-.4 0-.8.1-1.2.3" />
                <path d="M12 17h.01" />
              </Icon>
            ),
          },
          {
            href: '/dashboard/question-bank/',
            label: props.questionBankLink,
            active: isActive('/dashboard/question-bank'),
            icon: (
              <Icon>
                <path d="m16 6 4 14" />
                <path d="M12 6v14" />
                <path d="M8 8v12" />
                <path d="M4 4v16" />
              </Icon>
            ),
          },
        ]
      : [
          {
            href: '/dashboard/sessions/',
            label: props.mySessions,
            active: isActive('/dashboard/sessions'),
            icon: (
              <Icon>
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" />
              </Icon>
            ),
          },
        ]),
    {
      href: '/dashboard/user-profile/',
      label: props.userProfileLink,
      active: isActive('/dashboard/user-profile'),
      icon: (
        <Icon>
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </Icon>
      ),
    },
  ];

  const roleTag = (
    <Badge variant={isTeacher ? 'success' : 'info'}>
      {isTeacher ? props.teacherRole : props.studentRole}
    </Badge>
  );

  const renderNav = (expanded: boolean) => (
    <nav aria-label={t('nav_label')}>
      <ul className="flex flex-col gap-1">
        {items.map(item => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              title={expanded ? undefined : item.label}
              className={cn(s.navLink, item.active && s.navLinkCurrent, !expanded && 'justify-center px-0')}
            >
              {item.icon}
              {expanded
                ? <span>{item.label}</span>
                : <span className="sr-only">{item.label}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <>
      {/* Mobile: brand row with the menu button */}
      <div className="flex items-center gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className={cn(s.btn, 'px-3')}
          aria-label={t('open_menu')}
          aria-expanded={isMobileOpen}
        >
          <Icon>
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </Icon>
        </button>
        <Link href={`/${locale}/`} className={cn(s.script, s.chalk, 'inline-flex min-h-11 items-center text-2xl font-bold')}>
          {AppConfig.name}
        </Link>
        {roleTag}
      </div>

      <Modal
        open={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        title={AppConfig.name}
        titleClassName={s.script}
        placement="left"
      >
        <div>{roleTag}</div>
        <div className={s.rule} />
        {renderNav(true)}
      </Modal>

      {/* Desktop: navigation column on the board */}
      <aside
        suppressHydrationWarning
        className={cn(
          'hidden shrink-0 flex-col gap-4 border-r-2 border-dashed border-chalk-faint pr-[18px] lg:flex',
          isExpanded ? 'w-[230px]' : 'w-[78px]',
        )}
      >
        <div className={cn('flex items-center gap-2', isExpanded ? 'justify-between' : 'justify-center')}>
          {isExpanded && (
            <Link href={`/${locale}/`} className={cn(s.script, s.chalk, 'inline-flex min-h-11 items-center text-3xl font-bold')}>
              {AppConfig.name}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className={cn(s.btn, s.btnSm, 'px-2')}
            aria-label={isExpanded ? props.collapseSidebar : props.expandSidebar}
            aria-expanded={isExpanded}
            title={isExpanded ? props.collapseSidebar : props.expandSidebar}
          >
            <Icon>
              {isExpanded ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
            </Icon>
          </button>
        </div>
        {isExpanded && <div>{roleTag}</div>}
        <div className={s.rule} />
        {renderNav(isExpanded)}
      </aside>
    </>
  );
}
