'use client';

import { useEffect } from 'react';

import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <h2>發生錯誤了</h2>
        <button onClick={() => reset()}>重試</button>
      </body>
    </html>
  );
}
