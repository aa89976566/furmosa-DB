/**
 * 早安排程 runner（Preview MVP：只 dry-run，不真送 LINE）
 */

import {
  MORNING_CAMPAIGN_KEY,
  MORNING_PREVIEW_DRY_RUN_ONLY,
  MORNING_SKIP_REASONS,
  type MorningContentMode,
} from '@/lib/line/morning/constants';
import { pickApprovedJoke, markContentUsed } from '@/lib/line/morning/content';
import { recordMorningDelivery } from '@/lib/line/morning/delivery';
import {
  defaultMockNewsProvider,
} from '@/lib/line/morning/news/mock-feed';
import {
  pickAutoApprovedNews,
  processCandidates,
  type MorningNewsProvider,
} from '@/lib/line/morning/news/provider';
import {
  isActivelySubscribed,
  type MorningPreferenceRow,
} from '@/lib/line/morning/preferences';
import { renderJokeMessage, renderNewsMessage } from '@/lib/line/morning/renderer';
import {
  frequencyMatchesDay,
  isSlotDue,
  isWithinMorningWindow,
  morningSlotMinute,
  morningTaipeiDate,
} from '@/lib/line/morning/schedule';
import { countDeliveriesToday, getMorningSettings } from '@/lib/line/morning/settings';
import {
  defaultTransactionalProvider,
  type TransactionalSignalProvider,
} from '@/lib/line/morning/transactional';
import { prisma } from '@/lib/prisma';

export type MorningRecipient = {
  lineUserId: string;
  customerName: string | null;
  petSpecies: string | null;
  preference: MorningPreferenceRow;
};

export type MorningPlanResult = {
  lineUserId: string;
  taipeiDate: string;
  slotMinute: number;
  outcome: 'DRY_RUN' | 'SKIPPED' | 'ALREADY';
  skipReason?: string;
  renderedText?: string;
  contentKind?: 'joke' | 'news';
  contentId?: string;
  newsFingerprint?: string;
  deliveryId?: string;
  created?: boolean;
};

export type MorningRunSummary = {
  dryRunOnly: boolean;
  masterEnabled: boolean;
  taipeiDate: string;
  withinWindow: boolean;
  quota: { used: number; limit: number };
  planned: MorningPlanResult[];
  notes: string[];
};

function mapPetTag(species: string | null): Array<'dog' | 'cat' | 'rabbit' | 'bird' | 'rodent'> {
  if (!species) return [];
  if (species === 'dog') return ['dog'];
  if (species === 'cat') return ['cat'];
  if (species === 'rabbit') return ['rabbit'];
  if (species === 'bird_reptile') return ['bird'];
  if (species === 'small_mammal') return ['rodent'];
  return [];
}

function chooseKind(
  mode: MorningContentMode,
  taipeiDate: string,
): 'joke' | 'news' {
  if (mode === 'jokes') return 'joke';
  if (mode === 'news') return 'news';
  // alternate：用日期奇偶
  const dayNum = Number(taipeiDate.replace(/-/g, ''));
  return dayNum % 2 === 0 ? 'joke' : 'news';
}

export async function loadActiveMorningRecipients(): Promise<MorningRecipient[]> {
  const prefs = await prisma.lineMorningPreference.findMany({
    where: {
      pausedAt: null,
      contentMode: { notIn: ['off', 'unset'] },
      frequency: { notIn: ['off', 'unset'] },
    },
  });
  if (prefs.length === 0) return [];

  const lineIds = prefs.map((p) => p.lineUserId);
  const customers = await prisma.customer.findMany({
    where: { lineUserId: { in: lineIds } },
    select: { lineUserId: true, name: true, petSpecies: true },
  });
  const byLine = new Map(customers.map((c) => [c.lineUserId!, c]));

  return prefs
    .map((p) => {
      const c = byLine.get(p.lineUserId);
      const preference = {
        id: p.id,
        lineUserId: p.lineUserId,
        customerId: p.customerId,
        contentMode: p.contentMode as MorningPreferenceRow['contentMode'],
        frequency: p.frequency as MorningPreferenceRow['frequency'],
        pausedAt: p.pausedAt,
        promptedAt: p.promptedAt,
      };
      if (!isActivelySubscribed(preference)) return null;
      return {
        lineUserId: p.lineUserId,
        customerName: c?.name ?? null,
        petSpecies: c?.petSpecies ?? null,
        preference,
      };
    })
    .filter((x): x is MorningRecipient => Boolean(x));
}

export async function planOneRecipient(opts: {
  recipient: MorningRecipient;
  now?: Date;
  enforceWindow?: boolean;
  enforceSlot?: boolean;
  transactional?: TransactionalSignalProvider;
  newsProvider?: MorningNewsProvider;
  markUsed?: boolean;
}): Promise<MorningPlanResult> {
  const now = opts.now ?? new Date();
  const taipeiDate = morningTaipeiDate(now);
  const slotMinute = morningSlotMinute(opts.recipient.lineUserId);
  const transactional = opts.transactional ?? defaultTransactionalProvider;
  const newsProvider = opts.newsProvider ?? defaultMockNewsProvider;

  const existing = await prisma.lineMorningDelivery.findUnique({
    where: {
      lineUserId_campaignKey_taipeiDate: {
        lineUserId: opts.recipient.lineUserId,
        campaignKey: MORNING_CAMPAIGN_KEY,
        taipeiDate,
      },
    },
  });
  if (existing) {
    return {
      lineUserId: opts.recipient.lineUserId,
      taipeiDate,
      slotMinute,
      outcome: 'ALREADY',
      skipReason: MORNING_SKIP_REASONS.ALREADY_DELIVERED,
      deliveryId: existing.id,
      created: false,
      renderedText: existing.renderedText ?? undefined,
    };
  }

  if (!frequencyMatchesDay(opts.recipient.preference.frequency, now)) {
    const recorded = await recordMorningDelivery({
      lineUserId: opts.recipient.lineUserId,
      taipeiDate,
      status: 'SKIPPED',
      skipReason: MORNING_SKIP_REASONS.FREQUENCY_MISMATCH,
      slotMinute,
    });
    return {
      lineUserId: opts.recipient.lineUserId,
      taipeiDate,
      slotMinute,
      outcome: 'SKIPPED',
      skipReason: MORNING_SKIP_REASONS.FREQUENCY_MISMATCH,
      deliveryId: recorded.id,
      created: recorded.created,
    };
  }

  if (opts.enforceWindow !== false && !isWithinMorningWindow(now)) {
    // dry-run 排程可選擇不 enforce；預設在 window 外不寫 SKIP（留给真正 cron）
    // Preview dry-run 常會傳 enforceWindow=false
    return {
      lineUserId: opts.recipient.lineUserId,
      taipeiDate,
      slotMinute,
      outcome: 'SKIPPED',
      skipReason: MORNING_SKIP_REASONS.OUTSIDE_WINDOW,
    };
  }

  if (opts.enforceSlot && !isSlotDue(opts.recipient.lineUserId, now)) {
    return {
      lineUserId: opts.recipient.lineUserId,
      taipeiDate,
      slotMinute,
      outcome: 'SKIPPED',
      skipReason: MORNING_SKIP_REASONS.SLOT_NOT_YET,
    };
  }

  const txHits = await transactional.findSignalsForMorning(
    opts.recipient.lineUserId,
    taipeiDate,
    now,
  );
  if (txHits.length > 0) {
    const recorded = await recordMorningDelivery({
      lineUserId: opts.recipient.lineUserId,
      taipeiDate,
      status: 'SKIPPED',
      skipReason: MORNING_SKIP_REASONS.TRANSACTIONAL_PRIORITY,
      slotMinute,
      renderedText: `tx:${txHits.map((h) => h.channel).join(',')}`,
    });
    return {
      lineUserId: opts.recipient.lineUserId,
      taipeiDate,
      slotMinute,
      outcome: 'SKIPPED',
      skipReason: MORNING_SKIP_REASONS.TRANSACTIONAL_PRIORITY,
      deliveryId: recorded.id,
      created: recorded.created,
    };
  }

  const contentMode = opts.recipient.preference.contentMode;
  const kind = chooseKind(contentMode, taipeiDate);

  if (kind === 'news') {
    const processed = processCandidates(await newsProvider.fetchCandidates(now), now);
    const news = pickAutoApprovedNews(processed);
    if (!news) {
      // 純 NEWS：無安全新聞必須 skip，不得改成笑話
      // ALTERNATE：才可退回已核准笑話
      if (contentMode !== 'alternate') {
        const recorded = await recordMorningDelivery({
          lineUserId: opts.recipient.lineUserId,
          taipeiDate,
          status: 'SKIPPED',
          skipReason: MORNING_SKIP_REASONS.NO_SAFE_NEWS,
          slotMinute,
          renderedText: '今天沒有通過安全檢查的新鮮事',
        });
        return {
          lineUserId: opts.recipient.lineUserId,
          taipeiDate,
          slotMinute,
          outcome: 'SKIPPED',
          skipReason: MORNING_SKIP_REASONS.NO_SAFE_NEWS,
          deliveryId: recorded.id,
          created: recorded.created,
          renderedText: '今天沒有通過安全檢查的新鮮事',
        };
      }

      const joke = await pickApprovedJoke({
        preferredTags: mapPetTag(opts.recipient.petSpecies),
        now,
      });
      if (!joke) {
        const recorded = await recordMorningDelivery({
          lineUserId: opts.recipient.lineUserId,
          taipeiDate,
          status: 'SKIPPED',
          skipReason: MORNING_SKIP_REASONS.NO_CONTENT,
          slotMinute,
        });
        return {
          lineUserId: opts.recipient.lineUserId,
          taipeiDate,
          slotMinute,
          outcome: 'SKIPPED',
          skipReason: MORNING_SKIP_REASONS.NO_CONTENT,
          deliveryId: recorded.id,
          created: recorded.created,
        };
      }
      const rendered = renderJokeMessage({
        body: joke.body,
        customerName: opts.recipient.customerName,
      });
      const recorded = await recordMorningDelivery({
        lineUserId: opts.recipient.lineUserId,
        taipeiDate,
        status: 'DRY_RUN',
        contentKind: 'joke',
        contentId: joke.id,
        slotMinute,
        renderedText: rendered.text,
      });
      if (recorded.created && opts.markUsed) {
        await markContentUsed(joke.id, now);
      }
      return {
        lineUserId: opts.recipient.lineUserId,
        taipeiDate,
        slotMinute,
        outcome: 'DRY_RUN',
        contentKind: 'joke',
        contentId: joke.id,
        renderedText: rendered.text,
        deliveryId: recorded.id,
        created: recorded.created,
      };
    }

    const newsRow = await prisma.lineMorningNewsItem.upsert({
      where: { contentHash: news.contentHash },
      create: {
        fingerprint: news.contentHash,
        contentHash: news.contentHash,
        canonicalUrl: news.canonicalUrl,
        sourceName: news.sourceName,
        sourceId: news.sourceId,
        publishedAt: news.publishedAt,
        fetchedAt: now,
        region: news.region,
        riskLevel: news.riskLevel,
        status: news.status,
        title: news.title,
        factSummary: news.factSummary,
        barkLine: news.barkLine,
        riskLabels: JSON.stringify(news.riskLabels),
        confidence: news.confidence,
        speciesTags: JSON.stringify(news.speciesTags),
        gateReasons: JSON.stringify(news.safetyReasons),
      },
      update: {
        status: news.status,
        riskLevel: news.riskLevel,
        factSummary: news.factSummary,
        barkLine: news.barkLine,
        riskLabels: JSON.stringify(news.riskLabels),
        confidence: news.confidence,
        gateReasons: JSON.stringify(news.safetyReasons),
        fetchedAt: now,
      },
    });

    const rendered = renderNewsMessage({
      factSummary: news.factSummary,
      barkLine: news.barkLine,
      sourceName: news.sourceName,
      canonicalUrl: news.canonicalUrl,
      publishedAt: news.publishedAt,
    });
    const recorded = await recordMorningDelivery({
      lineUserId: opts.recipient.lineUserId,
      taipeiDate,
      status: 'DRY_RUN',
      contentKind: 'news',
      newsItemId: newsRow.id,
      slotMinute,
      renderedText: rendered.text,
    });
    return {
      lineUserId: opts.recipient.lineUserId,
      taipeiDate,
      slotMinute,
      outcome: 'DRY_RUN',
      contentKind: 'news',
      newsFingerprint: news.contentHash,
      renderedText: rendered.text,
      deliveryId: recorded.id,
      created: recorded.created,
    };
  }

  // joke path
  const joke = await pickApprovedJoke({
    preferredTags: mapPetTag(opts.recipient.petSpecies),
    now,
  });
  if (!joke) {
    const recorded = await recordMorningDelivery({
      lineUserId: opts.recipient.lineUserId,
      taipeiDate,
      status: 'SKIPPED',
      skipReason: MORNING_SKIP_REASONS.NO_CONTENT,
      slotMinute,
    });
    return {
      lineUserId: opts.recipient.lineUserId,
      taipeiDate,
      slotMinute,
      outcome: 'SKIPPED',
      skipReason: MORNING_SKIP_REASONS.NO_CONTENT,
      deliveryId: recorded.id,
      created: recorded.created,
    };
  }

  const rendered = renderJokeMessage({
    body: joke.body,
    customerName: opts.recipient.customerName,
  });
  const recorded = await recordMorningDelivery({
    lineUserId: opts.recipient.lineUserId,
    taipeiDate,
    status: 'DRY_RUN',
    contentKind: 'joke',
    contentId: joke.id,
    slotMinute,
    renderedText: rendered.text,
  });
  if (recorded.created && opts.markUsed) {
    await markContentUsed(joke.id, now);
  }
  return {
    lineUserId: opts.recipient.lineUserId,
    taipeiDate,
    slotMinute,
    outcome: 'DRY_RUN',
    contentKind: 'joke',
    contentId: joke.id,
    renderedText: rendered.text,
    deliveryId: recorded.id,
    created: recorded.created,
  };
}

/**
 * Preview dry-run：不真送、可在窗外模擬、寫入 DRY_RUN／SKIPPED 紀錄。
 * master kill switch OFF 時仍可模擬（標 skip），方便驗證。
 */
export async function runMorningDryRun(opts?: {
  now?: Date;
  limit?: number;
  enforceWindow?: boolean;
  enforceSlot?: boolean;
  markUsed?: boolean;
}): Promise<MorningRunSummary> {
  const options = opts ?? {};
  const now = options.now ?? new Date();
  const taipeiDate = morningTaipeiDate(now);
  const settings = await getMorningSettings();
  const used = await countDeliveriesToday(taipeiDate);
  const notes: string[] = [
    'Preview MVP：dry-run only，不會呼叫 LINE Push。',
    '未加入 vercel.json Production cron。',
  ];

  if (!settings.masterEnabled) {
    notes.push('master kill switch OFF（預設）。');
  }

  const recipients = await loadActiveMorningRecipients();
  const planned: MorningPlanResult[] = [];
  let quotaUsed = used;

  for (const recipient of recipients.slice(0, options.limit ?? 500)) {
    if (!settings.masterEnabled) {
      const slotMinute = morningSlotMinute(recipient.lineUserId);
      const recorded = await recordMorningDelivery({
        lineUserId: recipient.lineUserId,
        taipeiDate,
        status: 'SKIPPED',
        skipReason: MORNING_SKIP_REASONS.KILL_SWITCH,
        slotMinute,
      });
      planned.push({
        lineUserId: recipient.lineUserId,
        taipeiDate,
        slotMinute,
        outcome: recorded.created ? 'SKIPPED' : 'ALREADY',
        skipReason: recorded.created
          ? MORNING_SKIP_REASONS.KILL_SWITCH
          : MORNING_SKIP_REASONS.ALREADY_DELIVERED,
        deliveryId: recorded.id,
        created: recorded.created,
      });
      continue;
    }

    if (quotaUsed >= settings.dailyQuota) {
      const slotMinute = morningSlotMinute(recipient.lineUserId);
      const recorded = await recordMorningDelivery({
        lineUserId: recipient.lineUserId,
        taipeiDate,
        status: 'SKIPPED',
        skipReason: MORNING_SKIP_REASONS.QUOTA,
        slotMinute,
      });
      planned.push({
        lineUserId: recipient.lineUserId,
        taipeiDate,
        slotMinute,
        outcome: recorded.created ? 'SKIPPED' : 'ALREADY',
        skipReason: recorded.created
          ? MORNING_SKIP_REASONS.QUOTA
          : MORNING_SKIP_REASONS.ALREADY_DELIVERED,
        deliveryId: recorded.id,
        created: recorded.created,
      });
      continue;
    }

    const result = await planOneRecipient({
      recipient,
      now,
      enforceWindow: options.enforceWindow ?? false,
      enforceSlot: options.enforceSlot ?? false,
      markUsed: options.markUsed ?? false,
    });
    planned.push(result);
    if (result.outcome === 'DRY_RUN' && result.created) {
      quotaUsed += 1;
    }
  }

  return {
    dryRunOnly: MORNING_PREVIEW_DRY_RUN_ONLY,
    masterEnabled: settings.masterEnabled,
    taipeiDate,
    withinWindow: isWithinMorningWindow(now),
    quota: { used: quotaUsed, limit: settings.dailyQuota },
    planned,
    notes,
  };
}
