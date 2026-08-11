'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  PreviewFlexMessage,
  PreviewLineMessage,
} from '@/lib/line-preview/types';

type FlexNode = Record<string, unknown>;

const SIZE_CLASS: Record<string, string> = {
  xxs: 'text-[10px] leading-snug',
  xs: 'text-xs leading-snug',
  sm: 'text-sm leading-relaxed',
  md: 'text-base leading-relaxed',
  lg: 'text-lg leading-snug',
  xl: 'text-xl leading-snug',
  xxl: 'text-2xl leading-snug',
  '3xl': 'text-3xl leading-tight',
  '4xl': 'text-4xl leading-tight',
  '5xl': 'text-5xl leading-none',
};

function asNodes(value: unknown): FlexNode[] {
  return Array.isArray(value) ? (value as FlexNode[]) : [];
}

function FlexNodeView({ node }: { node: FlexNode }) {
  const type = String(node.type ?? '');

  if (type === 'text') {
    const size = String(node.size ?? 'sm');
    const weight = String(node.weight ?? 'regular');
    const color = typeof node.color === 'string' ? node.color : undefined;
    const wrap = node.wrap !== false;
    return (
      <p
        className={cn(
          SIZE_CLASS[size] ?? SIZE_CLASS.sm,
          weight === 'bold' && 'font-bold',
          wrap ? 'break-words whitespace-pre-wrap' : 'truncate',
        )}
        style={color ? { color } : undefined}
        data-flex-size={size}
        data-flex-weight={weight}
      >
        {String(node.text ?? '')}
      </p>
    );
  }

  if (type === 'separator') {
    return <hr className="my-2 border-stone-200" />;
  }

  if (type === 'button') {
    const action = node.action as { label?: string } | undefined;
    return (
      <div className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-center text-sm font-medium text-stone-900">
        {action?.label ?? '按鈕'}
      </div>
    );
  }

  if (type === 'box') {
    const layout = String(node.layout ?? 'vertical');
    const bg =
      typeof node.backgroundColor === 'string'
        ? node.backgroundColor
        : undefined;
    const border =
      typeof node.borderColor === 'string' ? node.borderColor : undefined;
    const radius =
      typeof node.cornerRadius === 'string' ? node.cornerRadius : undefined;
    const pad =
      typeof node.paddingAll === 'string' ? node.paddingAll : undefined;
    return (
      <div
        className={cn(
          'gap-1.5',
          layout === 'horizontal' ? 'flex flex-row items-start' : 'flex flex-col',
        )}
        style={{
          backgroundColor: bg,
          borderColor: border,
          borderWidth: border ? 2 : undefined,
          borderStyle: border ? 'solid' : undefined,
          borderRadius: radius,
          padding: pad,
        }}
        data-flex-box=""
      >
        {asNodes(node.contents).map((child, idx) => (
          <FlexNodeView key={idx} node={child} />
        ))}
      </div>
    );
  }

  if (type === 'bubble') {
    const body = node.body as FlexNode | undefined;
    const footer = node.footer as FlexNode | undefined;
    return (
      <div className="overflow-hidden rounded-2xl border border-orange-200 bg-[#F8F3EA] shadow-sm">
        {body ? (
          <div className="space-y-2 px-3 py-3 sm:px-4">
            <FlexNodeView node={body} />
          </div>
        ) : null}
        {footer ? (
          <div className="space-y-2 border-t border-orange-100 bg-orange-50/60 px-3 py-3">
            <FlexNodeView node={footer} />
          </div>
        ) : null}
      </div>
    );
  }

  // unknown / image / etc — skip heavy absolute backgrounds for QA readability
  if (asNodes(node.contents).length > 0) {
    return (
      <div className="space-y-1">
        {asNodes(node.contents).map((child, idx) => (
          <FlexNodeView key={idx} node={child} />
        ))}
      </div>
    );
  }

  return null;
}

function FlexStructuralPreview({ msg }: { msg: PreviewFlexMessage }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-orange-800">
        {'Flex · '}
        {msg.altText}
      </p>
      <FlexNodeView node={msg.contents as FlexNode} />
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
            'whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-stone-100 text-stone-900',
          )}
        >
          {message.text}
        </div>
        <RawJsonBlock value={message} />
      </div>
    );
  }

  if (message.type === 'image') {
    return (
      <div className="max-w-[92%]">
        <div className="overflow-hidden rounded-2xl border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={message.originalContentUrl}
            alt="預覽圖片"
            className="max-h-56 w-full object-cover"
          />
        </div>
        <RawJsonBlock value={message} />
      </div>
    );
  }

  return (
    <div className="max-w-[92%] min-w-0">
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
            'flex min-w-0 flex-col gap-2',
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
