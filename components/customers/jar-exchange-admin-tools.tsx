'use client';

import { useState } from 'react';
import { Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  adminRedeemJarCode,
  enableJarExchangeForCustomer,
} from '@/app/(main)/jar-exchange/actions';

export function JarExchangeAdminTools({ customerId }: { customerId: string }) {
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Ticket className="h-3.5 w-3.5 shrink-0" />
        <span>代客操作</span>
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="輸入 8 位序號"
          inputMode="numeric"
          className="h-8 max-w-[140px] font-mono text-xs"
        />
        <Button
          type="button"
          size="sm"
          disabled={pending || !code.trim()}
          onClick={async () => {
            setPending(true);
            setMsg(null);
            try {
              const res = await adminRedeemJarCode(customerId, code);
              setMsg(res.ok ? `+${res.pointsEarned} 點 · 餘額 ${res.balanceAfter}` : res.error);
              if (res.ok) setCode('');
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? '兌換中…' : '兌換序號'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-xs text-muted-foreground"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setMsg(null);
            try {
              const res = await enableJarExchangeForCustomer(customerId);
              setMsg(res.ok ? (res.alreadyMember ? '已是換罐會員' : '已開通') : res.error);
            } finally {
              setPending(false);
            }
          }}
        >
          開通服務
        </Button>
      </div>
      {msg ? <p className="w-full text-xs text-muted-foreground sm:w-auto">{msg}</p> : null}
    </div>
  );
}
