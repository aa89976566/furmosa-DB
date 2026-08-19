'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  PreviewFlexMessage,
  PreviewLineMessage,
} from '@/lib/line/campaigns/jiba-unbox/preview-types';
import { extractFlexButtonLabels } from '@/lib/line/campaigns/jiba-unbox/preview-messages';

function FlexStructuralPreview({ msg }: { msg: PreviewFlexMessage }) {
  const labels = extractFlexButtonLabels(msg);
  const body = msg.contents as {
    body?: { contents?: { type?: string; text?: string }[] };
  };
  const title = body.body?.contents?.find((c) => c.type === 'text')?.text;
  const subtitle = body.body?.contents?.filter((c) => c.type === 'text')[1]?.text;

  return (
    <div className="overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm">
      <div className="space-y-1 bg-white px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-orange-800">
          {'Flex · '}
          {msg.altText}
        </p>
        {title ? (
          <p className="text-base font-semibold text-stone-900">{title}</p>
        ) : null}
        {subtitle ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
            {subtitle}
          </p>
        ) : null}
      </div>
      {labels.length > 0 ? (
        <div className="space-y-2 bg-orange-50 px-3 py-3">
          {labels.map((label) => (
            <div
              key={label}
              className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-center text-sm font-medium text-stone-900"
            >
              {label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RawJsonBlock({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        原始 JSON payload
      </Button>
      {open ? (
        <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

export function PreviewMessageBubble({
  message,
  role,
}: {
  message: PreviewLineMessage;
  role: 'bot' | 'user';
}) {
  const isUser = role === 'user';

  if (message.type === 'text') {
    return (
      <div className={cn('max-w-[92%]', isUser && 'ml-auto')}>
        <div
          className={cn(
            'whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-stone-100 text-stone-900',
          )}
        >
          {message.text}
        </div>
        {message.quickReply?.items?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.quickReply.items.map((item, idx) => (
              <span
                key={`${item.action.label}-${idx}`}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground"
              >
                {'QR · '}
                {item.action.label}
              </span>
            ))}
          </div>
        ) : null}
        <RawJsonBlock value={message} />
      </div>
    );
  }

  if (message.type === 'image') {
    return (
      <div className="max-w-[92%]">
        <div className="overflow-hidden rounded-2xl border bg-muted">
          {/* 同 origin 靜態資源；預覽不打外網 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.originalContentUrl}
            alt="開箱封面（預覽）"
            className="max-h-56 w-full object-cover"
          />
        </div>
        <RawJsonBlock value={message} />
      </div>
    );
  }

  return (
    <div className="max-w-[92%]">
      <FlexStructuralPreview msg={message} />
      <RawJsonBlock value={message} />
    </div>
  );
}

export function PreviewTranscript({
  items,
}: {
  items: {
    id: string;
    role: 'bot' | 'user';
    messages: PreviewLineMessage[];
  }[];
}) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'flex flex-col gap-2',
            item.role === 'user' ? 'items-end' : 'items-start',
          )}
        >
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.role === 'user' ? '使用者（模擬）' : '匠寵 Bot（預覽）'}
          </span>
          {item.messages.map((msg, idx) => (
            <PreviewMessageBubble
              key={`${item.id}-${idx}`}
              message={msg}
              role={item.role}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
