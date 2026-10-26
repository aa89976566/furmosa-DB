'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';

export function FormSubmitButton({ children, pendingLabel = '儲存中…' }: {
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return <Button size="lg" type="submit" disabled={pending} aria-busy={pending}>
    <span role="status" aria-live="polite">{pending ? pendingLabel : children}</span>
  </Button>;
}
