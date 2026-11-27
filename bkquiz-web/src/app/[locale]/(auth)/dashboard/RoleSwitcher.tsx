'use client';

import type { ChangeEventHandler } from 'react';
import { useState } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { cn } from '@/utils/cn';

type RoleSwitcherProps = {
  currentRole: 'teacher' | 'student';
  /** Các vai trò tài khoản được dùng (chỉ render khi ≥ 2) */
  roles: ('teacher' | 'student')[];
  label: string;
  teacherLabel: string;
  studentLabel: string;
};

export function RoleSwitcher({
  currentRole,
  roles: allowedRoles,
  label,
  teacherLabel,
  studentLabel,
}: RoleSwitcherProps) {
  const [isLoading, setIsLoading] = useState(false);

  const roles: Array<{ value: 'teacher' | 'student'; label: string }> = [
    { value: 'teacher' as const, label: teacherLabel },
    { value: 'student' as const, label: studentLabel },
  ].filter(r => allowedRoles.includes(r.value));

  const handleChange: ChangeEventHandler<HTMLSelectElement> = async (event) => {
    const newRole = event.target.value as 'teacher' | 'student';

    if (newRole === currentRole || isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/user/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        // Force full page reload để đảm bảo cookie và role được apply
        window.location.reload();
      } else {
        const json = (await res.json()) as { error?: string; message?: string };
        console.error('Failed to switch role:', json.message || json.error);
        // Reset select về giá trị cũ
        event.target.value = currentRole;
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error switching role:', error);
      // Reset select về giá trị cũ
      event.target.value = currentRole;
      setIsLoading(false);
    }
  };

  return (
    <select
      defaultValue={currentRole}
      onChange={handleChange}
      disabled={isLoading}
      className={cn(s.btn, s.ledgeBtn)}
      aria-label={label}
      title={label}
    >
      {roles.map(role => (
        <option key={role.value} value={role.value}>
          {role.label}
        </option>
      ))}
    </select>
  );
}
