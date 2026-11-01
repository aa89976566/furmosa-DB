import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { getLineChannelId } from '@/lib/line/liff-config';

const originalLoginChannelId = process.env.LINE_LOGIN_CHANNEL_ID;
const originalLegacyChannelId = process.env.LINE_CHANNEL_ID;

afterEach(() => {
  if (originalLoginChannelId === undefined) delete process.env.LINE_LOGIN_CHANNEL_ID;
  else process.env.LINE_LOGIN_CHANNEL_ID = originalLoginChannelId;

  if (originalLegacyChannelId === undefined) delete process.env.LINE_CHANNEL_ID;
  else process.env.LINE_CHANNEL_ID = originalLegacyChannelId;
});

describe('getLineChannelId', () => {
  it('uses the production LINE Login channel variable', () => {
    process.env.LINE_LOGIN_CHANNEL_ID = 'login-channel';
    delete process.env.LINE_CHANNEL_ID;

    assert.equal(getLineChannelId(), 'login-channel');
  });

  it('keeps the legacy channel variable as a fallback', () => {
    delete process.env.LINE_LOGIN_CHANNEL_ID;
    process.env.LINE_CHANNEL_ID = 'legacy-channel';

    assert.equal(getLineChannelId(), 'legacy-channel');
  });

  it('prefers the LINE Login channel when both variables exist', () => {
    process.env.LINE_LOGIN_CHANNEL_ID = 'login-channel';
    process.env.LINE_CHANNEL_ID = 'legacy-channel';

    assert.equal(getLineChannelId(), 'login-channel');
  });
});
