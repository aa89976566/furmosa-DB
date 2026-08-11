'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * 二次確認後才 submit 既有 server action。
 * 取消 = 不 submit = 0 writes；server auth 仍是最終防線。
 */
export function ConfirmSubmitButton({
  action,
  hiddenFields,
  triggerLabel,
  triggerVariant = 'outline',
  title,
  description,
  confirmLabel = '確認',
  capability,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Record<string, string>;
  triggerLabel: string;
  triggerVariant?: 'default' | 'outline' | 'secondary' | 'ghost';
  title: string;
  description: string;
  confirmLabel?: string;
  capability: string;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <form ref={formRef} action={action} className="inline">
        {hiddenFields
          ? Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))
          : null}
        <Button
          ref={triggerRef}
          type="button"
          size="sm"
          variant={triggerVariant}
          data-capability={capability}
          onClick={() => setOpen(true)}
        >
          {triggerLabel}
        </Button>
      </form>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            // return focus to trigger
            queueMicrotask(() => triggerRef.current?.focus());
          }
        }}
      >
        <DialogContent
          onEscapeKeyDown={() => setOpen(false)}
          aria-describedby="morning-confirm-desc"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription id="morning-confirm-desc">
              {description}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            此操作只影響 Preview 驗收環境，不會發送真實 LINE 訊息。
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setOpen(false);
                formRef.current?.requestSubmit();
              }}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
