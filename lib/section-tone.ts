export const SECTION_TONES = [
  'overview',
  'master',
  'orders',
  'logistics',
  'subscription',
  'inventory',
  'finance',
  'supply',
  'operations',
] as const;

export type SectionTone = (typeof SECTION_TONES)[number];

type SectionToneStyle = {
  label: string;
  chip: string;
  header: string;
  card: string;
  cardBorder: string;
  icon: string;
  marker: string;
  eyebrow: string;
  sidebar: string;
  sidebarActive: string;
};

export const sectionToneStyles: Record<SectionTone, SectionToneStyle> = {
  overview: {
    label: '總覽',
    chip: 'bg-slate-500/12 text-slate-700 dark:text-slate-200',
    header: 'border-border/60 bg-slate-500/[0.06]',
    card: 'bg-card',
    cardBorder: 'border-slate-300/50 dark:border-slate-600/40',
    icon: 'bg-slate-500/12 text-slate-700 dark:text-slate-200',
    marker: 'bg-slate-500',
    eyebrow: 'text-slate-600 dark:text-slate-300',
    sidebar: 'text-muted-foreground',
    sidebarActive: 'bg-slate-500/10 text-navy ring-slate-500/15',
  },
  master: {
    label: '主資料',
    chip: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
    header: 'border-sky-500/15 bg-sky-500/[0.07]',
    card: 'bg-card',
    cardBorder: 'border-sky-400/35 dark:border-sky-500/30',
    icon: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
    marker: 'bg-sky-500',
    eyebrow: 'text-sky-700 dark:text-sky-300',
    sidebar: 'text-muted-foreground',
    sidebarActive: 'bg-sky-500/10 text-navy ring-sky-500/15',
  },
  orders: {
    label: '訂單',
    chip: 'bg-primary/12 text-primary',
    header: 'border-primary/15 bg-primary/[0.07]',
    card: 'bg-card',
    cardBorder: 'border-primary/30',
    icon: 'bg-primary/12 text-primary',
    marker: 'bg-primary',
    eyebrow: 'text-primary',
    sidebar: 'text-muted-foreground',
    sidebarActive: 'bg-primary/10 text-navy ring-primary/15',
  },
  logistics: {
    label: '物流',
    chip: 'bg-amber-500/12 text-amber-800 dark:text-amber-300',
    header: 'border-amber-500/15 bg-amber-500/[0.08]',
    card: 'bg-card',
    cardBorder: 'border-amber-400/35 dark:border-amber-500/30',
    icon: 'bg-amber-500/12 text-amber-800 dark:text-amber-300',
    marker: 'bg-amber-500',
    eyebrow: 'text-amber-700 dark:text-amber-300',
    sidebar: 'text-muted-foreground',
    sidebarActive: 'bg-amber-500/10 text-navy ring-amber-500/15',
  },
  subscription: {
    label: '訂閱',
    chip: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
    header: 'border-violet-500/15 bg-violet-500/[0.07]',
    card: 'bg-card',
    cardBorder: 'border-violet-400/35 dark:border-violet-500/30',
    icon: 'bg-violet-500/12 text-violet-700 dark:text-violet-300',
    marker: 'bg-violet-500',
    eyebrow: 'text-violet-700 dark:text-violet-300',
    sidebar: 'text-muted-foreground',
    sidebarActive: 'bg-violet-500/10 text-navy ring-violet-500/15',
  },
  inventory: {
    label: '庫存',
    chip: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    header: 'border-emerald-500/15 bg-emerald-500/[0.07]',
    card: 'bg-card',
    cardBorder: 'border-emerald-400/35 dark:border-emerald-500/30',
    icon: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    marker: 'bg-emerald-500',
    eyebrow: 'text-emerald-700 dark:text-emerald-300',
    sidebar: 'text-muted-foreground',
    sidebarActive: 'bg-emerald-500/10 text-navy ring-emerald-500/15',
  },
  supply: {
    label: '補給站',
    chip: 'bg-neutral-500/10 text-neutral-700 dark:text-neutral-300',
    header: 'border-neutral-200/80 bg-neutral-50/80',
    card: 'bg-card',
    cardBorder: 'border-neutral-200/60',
    icon: 'bg-neutral-500/10 text-neutral-700 dark:text-neutral-300',
    marker: 'bg-neutral-400',
    eyebrow: 'text-neutral-600 dark:text-neutral-400',
    sidebar: 'text-muted-foreground',
    sidebarActive: 'bg-neutral-500/10 text-navy ring-neutral-400/20',
  },
  finance: {
    label: '財務',
    chip: 'bg-success/12 text-success',
    header: 'border-success/15 bg-success/[0.07]',
    card: 'bg-card',
    cardBorder: 'border-success/30',
    icon: 'bg-success/12 text-success',
    marker: 'bg-success',
    eyebrow: 'text-success',
    sidebar: 'text-muted-foreground',
    sidebarActive: 'bg-success/10 text-navy ring-success/15',
  },
  operations: {
    label: '營運',
    chip: 'bg-info/12 text-info',
    header: 'border-info/15 bg-info/[0.07]',
    card: 'bg-card',
    cardBorder: 'border-info/30',
    icon: 'bg-info/12 text-info',
    marker: 'bg-info',
    eyebrow: 'text-info',
    sidebar: 'text-muted-foreground',
    sidebarActive: 'bg-info/10 text-navy ring-info/15',
  },
};

export function getRouteTone(pathname: string): SectionTone {
  if (pathname === '/' || pathname.startsWith('/dashboard')) return 'overview';
  if (
    pathname.startsWith('/vendors') ||
    pathname.startsWith('/customers') ||
    pathname.startsWith('/merchants') ||
    pathname.startsWith('/products')
  ) {
    return 'master';
  }
  if (pathname.startsWith('/orders')) return 'orders';
  if (pathname.startsWith('/shipments')) return 'logistics';
  if (pathname.startsWith('/subscriptions')) return 'subscription';
  if (pathname.startsWith('/inventory')) return 'inventory';
  if (pathname.startsWith('/supply') || pathname.startsWith('/jar-exchange')) return 'supply';
  if (pathname.startsWith('/settlements') || pathname.startsWith('/merchants/settlements')) {
    return 'finance';
  }
  if (pathname.startsWith('/tasks')) return 'operations';
  return 'overview';
}
