'use client';

import { useEffect, useState } from 'react';

/**
 * Fills the timezone from the browser, because a send time with no zone is
 * meaningless and asking a user to name their IANA zone is a poor trade.
 *
 * Editable rather than hidden: the guess is usually right, and when it is wrong
 * the user is the only one who can say so.
 */
export function TimezoneField() {
  const [zone, setZone] = useState('UTC');

  useEffect(() => {
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }, []);

  return (
    <label>
      <span className="lk-label">Time zone</span>
      <input
        className="lk-input"
        name="timezone"
        value={zone}
        onChange={(event) => setZone(event.target.value)}
        required
      />
    </label>
  );
}
