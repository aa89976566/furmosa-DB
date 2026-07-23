import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  clearJobThrottle,
  peekJobLastRun,
  runThrottled,
  shouldRunJob,
  markJobRan,
} from '../job-throttle';

describe('job-throttle', () => {
  beforeEach(() => {
    clearJobThrottle();
  });

  it('allows first run then blocks within TTL', () => {
    const now = 1_000_000;
    assert.equal(shouldRunJob('a', 5_000, now), true);
    markJobRan('a', now);
    assert.equal(shouldRunJob('a', 5_000, now + 1_000), false);
    assert.equal(shouldRunJob('a', 5_000, now + 5_001), true);
  });

  it('runThrottled executes once then skips', async () => {
    let n = 0;
    const first = await runThrottled('job', async () => {
      n += 1;
      return 'ok';
    }, 60_000);
    assert.deepEqual(first, { ran: true, result: 'ok' });
    const second = await runThrottled('job', async () => {
      n += 1;
      return 'again';
    }, 60_000);
    assert.deepEqual(second, { ran: false });
    assert.equal(n, 1);
    assert.ok(peekJobLastRun('job'));
  });

  it('clears mark on failure so retry is allowed', async () => {
    await assert.rejects(
      () =>
        runThrottled('fail', async () => {
          throw new Error('boom');
        }),
      /boom/,
    );
    assert.equal(shouldRunJob('fail', 60_000), true);
  });
});
