'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-Hant">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 600 }}>系統錯誤</h1>
        <p style={{ fontSize: '0.875rem', color: '#737373', marginTop: '0.75rem', whiteSpace: 'pre-wrap' }}>
          {error.message}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          再試一次
        </button>
      </body>
    </html>
  );
}
