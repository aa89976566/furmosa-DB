'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';

export function RestockSubmitButton({ children = '建立出貨單' }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? '建立中…' : children}
    </Button>
  );
}
