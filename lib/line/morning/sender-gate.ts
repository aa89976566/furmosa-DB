/**
 * Morning outbound sender gate：dry-run／Preview 必須 call count = 0
 */

import type { LineReplyMessage } from '@/lib/line/reply';
import { MORNING_PREVIEW_DRY_RUN_ONLY } from '@/lib/line/morning/constants';

export type MorningPushResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

export type MorningOutboundSender = {
  push: (
    lineUserId: string,
    messages: LineReplyMessage[],
    opts?: { expand?: boolean },
  ) => Promise<MorningPushResult>;
  getCallCount: () => number;
  resetCallCount: () => void;
};

/** 永遠不真送；呼叫會記數並 skipped */
export function createMorningDryRunSender(): MorningOutboundSender {
  let calls = 0;
  return {
    async push() {
      calls += 1;
      return {
        ok: true,
        skipped: true,
        error: 'morning_dry_run_sender_blocked',
      };
    },
    getCallCount: () => calls,
    resetCallCount: () => {
      calls = 0;
    },
  };
}

const defaultDryRunSender = createMorningDryRunSender();

/**
 * 取得 morning 路徑允許的 sender。
 * Preview／dry-run only 時永遠回 dry-run sender（真 LINE Push 不可達）。
 */
export function getMorningOutboundSender(opts?: {
  forceDryRun?: boolean;
  override?: MorningOutboundSender;
}): MorningOutboundSender {
  if (opts?.override) return opts.override;
  if (opts?.forceDryRun || MORNING_PREVIEW_DRY_RUN_ONLY) {
    return defaultDryRunSender;
  }
  // 保險：即使旗標被誤關，morning 模組仍不暴露真實 push
  return defaultDryRunSender;
}

export function assertMorningSenderUnused(
  sender: MorningOutboundSender,
): void {
  if (sender.getCallCount() !== 0) {
    throw new Error(
      `morning sender call count must be 0, got ${sender.getCallCount()}`,
    );
  }
}
