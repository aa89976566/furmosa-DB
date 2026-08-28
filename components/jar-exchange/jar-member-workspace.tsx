'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useMemo, useState, useTransition } from 'react';
import { ChevronDown, Filter, MessageSquareText, Search, Send, X } from 'lucide-react';
import { sendJarLineCampaign, type JarLineCampaignResult } from '@/app/(main)/jar-exchange/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  JarMemberRedeemMenu,
  type RedeemRewardOption,
} from '@/components/jar-exchange/jar-member-redeem-menu';

export type JarMemberWorkspaceRow = {
  id: string;
  customerId: string;
  name: string;
  phone: string | null;
  storeLabel: string;
  serviceStatus: string;
  lineLinked: boolean;
  points: number;
  redeemedCount: number;
  rewardCount: number;
  lastExchangeAt: string | null;
  lastReminderAt: string | null;
  isTest: boolean;
};

export type JarMessageLogRow = {
  id: string;
  createdAt: string;
  campaignName: string;
  audienceConditions: string;
  exclusionConditions: string;
  message: string;
  preventDuplicates: boolean;
  selectedCount: number;
  sent: number;
  skipped: number;
  failed: number;
};

type Filters = {
  q: string;
  serviceStatus: string;
  lineStatus: string;
  exchangeFrom: string;
  exchangeTo: string;
  neverExchanged: boolean;
  store: string;
  reminderFrom: string;
  reminderTo: string;
  memberKind: string;
};

const initialFilters: Filters = {
  q: '',
  serviceStatus: 'all',
  lineStatus: 'all',
  exchangeFrom: '',
  exchangeTo: '',
  neverExchanged: false,
  store: 'all',
  reminderFrom: '',
  reminderTo: '',
  memberKind: 'formal',
};

const serviceStatusLabel: Record<string, string> = {
  active: '啟用中',
  paused: '已暫停',
  closed: '已關閉',
};

function toDay(value: string | null) {
  return value ? value.slice(0, 10) : '';
}

function displayDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function filterSummary(filters: Filters) {
  const parts: string[] = [];
  if (filters.q) parts.push(`搜尋「${filters.q}」`);
  if (filters.serviceStatus !== 'all') {
    parts.push(`服務狀態：${serviceStatusLabel[filters.serviceStatus] ?? filters.serviceStatus}`);
  }
  if (filters.lineStatus !== 'all') {
    parts.push(`LINE：${filters.lineStatus === 'linked' ? '已綁定' : '未綁定'}`);
  }
  if (filters.neverExchanged) parts.push('從未換罐');
  if (filters.exchangeFrom || filters.exchangeTo) {
    parts.push(`最近換罐：${filters.exchangeFrom || '不限'}～${filters.exchangeTo || '不限'}`);
  }
  if (filters.store !== 'all') parts.push(`合作店：${filters.store}`);
  if (filters.reminderFrom || filters.reminderTo) {
    parts.push(`最近提醒：${filters.reminderFrom || '不限'}～${filters.reminderTo || '不限'}`);
  }
  if (filters.memberKind !== 'all') {
    parts.push(filters.memberKind === 'test' ? '測試會員' : '正式會員');
  }
  return parts.length ? parts.join('；') : '所有換罐會員';
}

export function JarMemberWorkspace({
  rows,
  messageLogs,
  rewards,
}: {
  rows: JarMemberWorkspaceRow[];
  messageLogs: JarMessageLogRow[];
  rewards: RedeemRewardOption[];
}) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [message, setMessage] = useState('');
  const [exclusionConditions, setExclusionConditions] = useState('未綁定 LINE、測試會員');
  const [preventDuplicates, setPreventDuplicates] = useState(true);
  const [result, setResult] = useState<JarLineCampaignResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const stores = useMemo(
    () => [...new Set(rows.map((row) => row.storeLabel).filter((value) => value !== '—'))].sort(),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const q = filters.q.trim().toLocaleLowerCase('zh-TW');
    return rows.filter((row) => {
      if (
        q &&
        ![row.name, row.phone ?? '', row.customerId, row.storeLabel]
          .join(' ')
          .toLocaleLowerCase('zh-TW')
          .includes(q)
      ) return false;
      if (filters.serviceStatus !== 'all' && row.serviceStatus !== filters.serviceStatus) return false;
      if (filters.lineStatus === 'linked' && !row.lineLinked) return false;
      if (filters.lineStatus === 'unlinked' && row.lineLinked) return false;
      if (filters.neverExchanged && row.lastExchangeAt) return false;
      if (filters.exchangeFrom && (!row.lastExchangeAt || toDay(row.lastExchangeAt) < filters.exchangeFrom)) return false;
      if (filters.exchangeTo && (!row.lastExchangeAt || toDay(row.lastExchangeAt) > filters.exchangeTo)) return false;
      if (filters.store !== 'all' && row.storeLabel !== filters.store) return false;
      if (filters.reminderFrom && (!row.lastReminderAt || toDay(row.lastReminderAt) < filters.reminderFrom)) return false;
      if (filters.reminderTo && (!row.lastReminderAt || toDay(row.lastReminderAt) > filters.reminderTo)) return false;
      if (filters.memberKind === 'formal' && row.isTest) return false;
      if (filters.memberKind === 'test' && !row.isTest) return false;
      return true;
    });
  }, [filters, rows]);

  const selectableRows = filteredRows.filter((row) => row.lineLinked && !row.isTest);
  const allVisibleSelected = selectableRows.length > 0 && selectableRows.every((row) => selectedIds.includes(row.id));
  const audienceConditions = filterSummary(filters);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelectedIds([]);
  };

  const toggleVisible = () => {
    const visibleIds = selectableRows.map((row) => row.id);
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])],
    );
  };

  const submitCampaign = () => {
    setResult(null);
    startTransition(async () => {
      const response = await sendJarLineCampaign({
        campaignName,
        selectedCustomerIds: selectedIds,
        audienceConditions,
        exclusionConditions,
        message,
        preventDuplicates,
      });
      setResult(response);
      if (response.ok) {
        setSelectedIds([]);
        router.refresh();
      }
    });
  };

  return (
    <Tabs defaultValue="members" className="space-y-4">
      <TabsList>
        <TabsTrigger value="members">會員資料</TabsTrigger>
        <TabsTrigger value="messages">訊息紀錄</TabsTrigger>
      </TabsList>

      <TabsContent value="members" className="space-y-4">
        <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Filter className="h-4 w-4" /> 篩選會員
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">條件可以交叉組合，名單會即時更新。</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setFilters(initialFilters); setSelectedIds([]); }}>
              清除條件
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">
              搜尋
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  value={filters.q}
                  onChange={(event) => setFilter('q', event.target.value)}
                  placeholder="姓名、電話、編號、合作店"
                  className="pl-9"
                />
              </div>
            </label>
            <FilterSelect label="服務狀態" value={filters.serviceStatus} onChange={(value) => setFilter('serviceStatus', value)}>
              <option value="all">全部狀態</option>
              <option value="active">啟用中</option>
              <option value="paused">已暫停</option>
              <option value="closed">已關閉</option>
            </FilterSelect>
            <FilterSelect label="LINE 狀態" value={filters.lineStatus} onChange={(value) => setFilter('lineStatus', value)}>
              <option value="all">全部</option>
              <option value="linked">已綁定</option>
              <option value="unlinked">未綁定</option>
            </FilterSelect>
            <DateRange label="最近換罐日期" from={filters.exchangeFrom} to={filters.exchangeTo} onFrom={(value) => setFilter('exchangeFrom', value)} onTo={(value) => setFilter('exchangeTo', value)} />
            <FilterSelect label="所屬合作店" value={filters.store} onChange={(value) => setFilter('store', value)}>
              <option value="all">全部合作店</option>
              {stores.map((store) => <option key={store} value={store}>{store}</option>)}
            </FilterSelect>
            <DateRange label="最近提醒日期" from={filters.reminderFrom} to={filters.reminderTo} onFrom={(value) => setFilter('reminderFrom', value)} onTo={(value) => setFilter('reminderTo', value)} />
            <FilterSelect label="資料類型" value={filters.memberKind} onChange={(value) => setFilter('memberKind', value)}>
              <option value="all">全部資料</option>
              <option value="formal">正式會員</option>
              <option value="test">測試會員</option>
            </FilterSelect>
          </div>

          <label className="mt-3 inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={filters.neverExchanged} onChange={(event) => setFilter('neverExchanged', event.target.checked)} className="h-4 w-4 rounded border-input" />
            從未換罐
          </label>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <p className="font-semibold">找到 {filteredRows.length} 位會員</p>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{audienceConditions}</p>
            </div>
            {selectedIds.length > 0 ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">已選 {selectedIds.length} 位</Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="sm">批次操作 <ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => { setResult(null); setComposerOpen(true); }}>
                      <Send className="mr-2 h-4 w-4" /> 發送 LINE 訊息
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[960px] w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-12 px-4 py-3"><input aria-label="選取目前名單" type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} /></th>
                  <th className="min-w-[190px] px-4 py-3 font-medium">會員</th>
                  <th className="min-w-[150px] px-4 py-3 font-medium">合作店</th>
                  <th className="min-w-[150px] px-4 py-3 font-medium">換罐狀態</th>
                  <th className="min-w-[140px] px-4 py-3 font-medium">最近換罐</th>
                  <th className="min-w-[140px] px-4 py-3 font-medium">最近提醒</th>
                  <th className="min-w-[250px] px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.map((row) => (
                  <MemberTableRow key={row.id} row={row} rewards={rewards} checked={selectedIds.includes(row.id)} onToggle={() => setSelectedIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y md:hidden">
            {filteredRows.map((row) => (
              <MemberCard key={row.id} row={row} rewards={rewards} checked={selectedIds.includes(row.id)} onToggle={() => setSelectedIds((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} />
            ))}
          </div>

          {filteredRows.length === 0 ? <p className="px-4 py-12 text-center text-sm text-muted-foreground">沒有符合條件的會員</p> : null}
        </section>
      </TabsContent>

      <TabsContent value="messages">
        <section className="space-y-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><MessageSquareText className="h-4 w-4" /> 訊息紀錄</h2>
            <p className="mt-1 text-sm text-muted-foreground">每次批次發送完成後，自動保存條件、內容與結果。</p>
          </div>
          {messageLogs.map((log) => (
            <details key={log.id} className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{log.campaignName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{displayDate(log.createdAt)} · 選取 {log.selectedCount} 位</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">送達 {log.sent}</Badge>
                    <Badge variant="outline">略過 {log.skipped}</Badge>
                    <Badge variant={log.failed ? 'destructive' : 'outline'}>失敗 {log.failed}</Badge>
                  </div>
                </div>
              </summary>
              <div className="mt-4 grid gap-3 border-t pt-4 text-sm md:grid-cols-2">
                <LogField label="收件條件" value={log.audienceConditions || '未填寫'} />
                <LogField label="排除條件" value={log.exclusionConditions || '未填寫'} />
                <LogField label="避免重複" value={log.preventDuplicates ? '已開啟' : '未開啟'} />
                <LogField label="訊息內容" value={log.message} className="md:col-span-2 whitespace-pre-wrap" />
              </div>
            </details>
          ))}
          {messageLogs.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">尚無批次訊息紀錄</div> : null}
        </section>
      </TabsContent>

      {composerOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="發送 LINE 訊息">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 shadow-xl sm:max-w-2xl sm:rounded-3xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-semibold">發送 LINE 訊息</h2><p className="mt-1 text-sm text-muted-foreground">本次選取 {selectedIds.length} 位，送出前會再次排除測試與未綁定會員。</p></div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setComposerOpen(false)} disabled={pending}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-4">
              <Field label="活動名稱"><Input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="例如：九月新口味換罐提醒" maxLength={80} /></Field>
              <Field label="收件條件"><textarea value={audienceConditions} readOnly className="min-h-20 w-full rounded-xl border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground" /></Field>
              <Field label="排除條件"><Input value={exclusionConditions} onChange={(event) => setExclusionConditions(event.target.value)} placeholder="例如：近 30 天已提醒、測試會員" /></Field>
              <Field label="訊息內容"><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="輸入要發送的 LINE 訊息" maxLength={2000} className="min-h-40 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /><p className="text-right text-xs text-muted-foreground">{message.length}/2000</p></Field>
              <label className="flex items-start gap-3 rounded-xl border border-border/70 p-3"><input type="checkbox" checked={preventDuplicates} onChange={(event) => setPreventDuplicates(event.target.checked)} className="mt-0.5 h-4 w-4" /><span><span className="block text-sm font-medium">避免重複發送</span><span className="block text-xs text-muted-foreground">同一活動名稱成功送達過的會員會自動略過。</span></span></label>
              {result ? <CampaignResult result={result} /> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setComposerOpen(false)} disabled={pending}>取消</Button>
              <Button type="button" onClick={submitCampaign} disabled={pending || campaignName.trim().length < 2 || !message.trim() || selectedIds.length === 0}>{pending ? '發送中…' : `確認發送 ${selectedIds.length} 則`}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </Tabs>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="space-y-1 text-xs font-medium text-muted-foreground">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground shadow-sm">{children}</select></label>;
}

function DateRange({ label, from, to, onFrom, onTo }: { label: string; from: string; to: string; onFrom: (value: string) => void; onTo: (value: string) => void }) {
  return <fieldset className="space-y-1"><legend className="text-xs font-medium text-muted-foreground">{label}</legend><div className="grid grid-cols-2 gap-2"><Input type="date" value={from} onChange={(event) => onFrom(event.target.value)} aria-label={`${label}開始`} /><Input type="date" value={to} onChange={(event) => onTo(event.target.value)} aria-label={`${label}結束`} /></div></fieldset>;
}

function MemberTableRow({ row, rewards, checked, onToggle }: { row: JarMemberWorkspaceRow; rewards: RedeemRewardOption[]; checked: boolean; onToggle: () => void }) {
  const disabled = !row.lineLinked || row.isTest;
  return <tr className={cn(checked && 'bg-muted/40')}>
    <td className="px-4 py-3"><input aria-label={`選取 ${row.name}`} type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} /></td>
    <td className="px-4 py-3"><div className="font-medium">{row.name} {row.isTest ? <Badge variant="outline" className="ml-1 text-[10px]">測試</Badge> : null}</div><div className="mt-0.5 text-xs text-muted-foreground">{row.customerId} · {row.phone ?? '無電話'}</div></td>
    <td className="px-4 py-3 text-muted-foreground">{row.storeLabel}</td>
    <td className="px-4 py-3"><Badge variant={row.serviceStatus === 'active' ? 'secondary' : 'outline'}>{serviceStatusLabel[row.serviceStatus] ?? row.serviceStatus}</Badge><div className="mt-1 text-xs text-muted-foreground">{row.points} 點 · 換罐 {row.redeemedCount} 次 · 獎勵 {row.rewardCount}</div></td>
    <td className="px-4 py-3 text-xs text-muted-foreground">{displayDate(row.lastExchangeAt)}</td>
    <td className="px-4 py-3 text-xs text-muted-foreground">{displayDate(row.lastReminderAt)}{!row.lineLinked ? <div className="mt-1 text-destructive">未綁定 LINE</div> : null}</td>
    <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1"><JarMemberRedeemMenu customerId={row.id} customerName={row.name} pointsBalance={row.points} rewards={rewards} /><Button asChild variant="ghost" size="sm"><Link href={`/customers/${row.id}`}>詳情</Link></Button></div></td>
  </tr>;
}

function MemberCard({ row, rewards, checked, onToggle }: { row: JarMemberWorkspaceRow; rewards: RedeemRewardOption[]; checked: boolean; onToggle: () => void }) {
  const disabled = !row.lineLinked || row.isTest;
  return <div className={cn('p-4', checked && 'bg-muted/40')}>
    <div className="flex items-start gap-3"><input aria-label={`選取 ${row.name}`} type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} className="mt-1" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{row.name}</p>{row.isTest ? <Badge variant="outline">測試</Badge> : null}<Badge variant={row.serviceStatus === 'active' ? 'secondary' : 'outline'}>{serviceStatusLabel[row.serviceStatus] ?? row.serviceStatus}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{row.storeLabel} · {row.lineLinked ? '已綁定 LINE' : '未綁定 LINE'}</p><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><LogField label="最近換罐" value={displayDate(row.lastExchangeAt)} /><LogField label="最近提醒" value={displayDate(row.lastReminderAt)} /></div><div className="mt-3 flex flex-wrap items-center gap-1"><JarMemberRedeemMenu customerId={row.id} customerName={row.name} pointsBalance={row.points} rewards={rewards} /><Button asChild variant="ghost" size="sm"><Link href={`/customers/${row.id}`}>詳情</Link></Button></div></div></div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5 text-sm font-medium">{label}{children}</label>; }
function LogField({ label, value, className }: { label: string; value: string; className?: string }) { return <div className={className}><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1">{value}</p></div>; }

function CampaignResult({ result }: { result: JarLineCampaignResult }) {
  if (!result.ok) return <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{result.error}</div>;
  return <div className="rounded-xl bg-muted p-3 text-sm"><p className="font-medium">送達 {result.sent}／略過 {result.skipped}／失敗 {result.failed}</p>{result.sentNames.length ? <p className="mt-1 text-xs text-muted-foreground">已送達：{result.sentNames.join('、')}</p> : null}{result.failedNames.length ? <p className="mt-1 text-xs text-destructive">失敗：{result.failedNames.join('、')}</p> : null}</div>;
}
