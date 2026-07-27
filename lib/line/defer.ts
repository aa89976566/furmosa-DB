/**
 * LINE Bot 回應加速：背景延續工作（Vercel waitUntil）。
 * 本機／非 Vercel 環境則直接 fire-and-forget。
 */
export function runAfterReply(task: Promise<unknown>): void {
  const p = Promise.resolve(task).catch((err) => {
    console.error('[line/defer] background task failed', err);
  });
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { waitUntil } = require('@vercel/functions') as {
      waitUntil?: (promise: Promise<unknown>) => void;
    };
    if (typeof waitUntil === 'function') {
      waitUntil(p);
      return;
    }
  } catch {
    // ignore
  }
  void p;
}
