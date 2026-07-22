import Link from 'next/link';
import { PosShell } from '@/components/pos/pos-shell';
import { Button } from '@/components/ui/button';

export default function PosRestockNotFound() {
  return (
    <PosShell>
      <div className="space-y-4 px-4 py-10">
        <h1 className="text-xl font-semibold text-navy">找不到這張申請</h1>
        <p className="text-sm text-muted-foreground">
          你沒有權限查看這張申請，或申請已不存在。
        </p>
        <Button asChild className="min-h-[44px] w-full">
          <Link href="/pos/restock/progress">回申請進度</Link>
        </Button>
      </div>
    </PosShell>
  );
}
