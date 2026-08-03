'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';

/**
 * A submit button that knows its own form is in flight.
 *
 * Every mutation here is a Server Action, and a Server Action on a cold function
 * can take a second or more. A plain `<button>` gives no sign it was pressed, so
 * people press it again — and each press is a real request. `markComplete` and
 * the upload survive that, but the user is still staring at a page that looks
 * broken.
 *
 * `useFormStatus` reads the pending state of the nearest parent `<form>`, which
 * is why this is one small client component rather than a prop threaded down
 * from each page: the pages stay Server Components, and nothing has to hold or
 * pass submission state. It also means a page with eight forms gets eight
 * independent pending states for free — marking one problem does not disable the
 * button next to another.
 *
 * `disabled` while pending is the part that actually prevents the double submit.
 * The label swap and the spinner are what make it obvious why.
 */
export function SubmitButton({
  pendingLabel,
  children,
  className = 'lk-btn',
  disabled,
  ...rest
}: ComponentProps<'button'> & { pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      {...rest}
      type="submit"
      className={className}
      disabled={pending || disabled}
      // Announces the wait to a screen reader, which cannot see the spinner.
      aria-busy={pending}
    >
      {pending ? (
        <>
          <span className="lk-spinner" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
