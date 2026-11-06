// Route callbacks are detached from the main UI awaits. A failed fetch during
// context.close() must not become an uncaught rejection with Cookie headers.
/** @param {(route: any) => Promise<any>} handler @param {(route: any) => void} onFailure */
export function createRouteBoundary(handler, onFailure) {
  const pending = new Set();
  return {
    handle(route) {
      let task;
      task = Promise.resolve().then(() => handler(route)).catch(async () => {
        // Record only a fixed failure signal, never the original exception.
        onFailure(route);
        try { await route.abort('failed'); } catch { /* context already closed */ }
      }).finally(() => pending.delete(task));
      pending.add(task);
      return task;
    },
    async settle() {
      // Called after context.close(); no new requests can start at this point.
      await Promise.all([...pending]);
    },
  };
}
