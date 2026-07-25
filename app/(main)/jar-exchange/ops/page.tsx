import { JarShell } from '@/components/jar-exchange/jar-shell';
import { JarOpsConsole } from '@/components/jar-exchange/ops-console';
import { getJarOpsConsoleData } from '@/lib/jar-exchange/ops';

export const dynamic = 'force-dynamic';

export default async function JarExchangeOpsPage() {
  const data = await getJarOpsConsoleData();

  return (
    <JarShell
      pathname="/jar-exchange/ops"
      title="換罐營運台"
      description="查看各店換罐庫存、營運狀態，並對低庫存一鍵建立補貨出貨單"
    >
      <JarOpsConsole data={data} />
    </JarShell>
  );
}
