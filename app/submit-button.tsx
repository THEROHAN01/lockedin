'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * A submit button that knows its own form is in flight.
 *
 * Every mutation here is a Server Action, and a Server Action on a cold
 * function can take a second or more. `useFormStatus` reads the pending
 * state of the nearest parent `<form>`, which is why this is one small
 * client component rather than a prop threaded down from each page: pages
 * stay Server Components, and a page with several forms gets independent
 * pending states for free.
 */
export function SubmitButton({
  pendingLabel,
  children,
  disabled,
  ...rest
}: ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      {...rest}
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
