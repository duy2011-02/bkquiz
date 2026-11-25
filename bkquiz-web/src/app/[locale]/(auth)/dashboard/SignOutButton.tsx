'use client';

import { SignOutClient } from './SignOutClient';

type SignOutButtonProps = {
  label: string;
};

/** Sign-out button sitting on the wooden ledge. */
export function SignOutButton({ label }: SignOutButtonProps) {
  return <SignOutClient label={label} buttonVariant="ledge" />;
}
