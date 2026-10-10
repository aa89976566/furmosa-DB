import {
  LayoutDashboard,
  Building2,
  Users,
  Store,
  Package,
  ShoppingCart,
  Boxes,
  CheckSquare,
  Repeat,
  Rocket,
  Gift,
  CalendarClock,
  ListChecks,
  Truck,
  BarChart3,
  PackageOpen,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { SectionTone } from '@/lib/section-tone';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  tone: SectionTone;
  items: NavItem[];
  collapsible?: boolean;
};

export const navGroups: NavGroup[] = [
  {
    label: '工作台',
    tone: 'operations',
    items: [
      { href: '/dashboard', label: '我的工作台', icon: LayoutDashboard },
      { href: '/mission', label: '今日進度', icon: BarChart3 },
      { href: '/tasks', label: '任務', icon: CheckSquare },
    ],
  },
  {
    label: '營運',
    tone: 'orders',
    items: [
      { href: '/orders', label: '訂單與履約', icon: ShoppingCart },
      { href: '/reviews', label: '待審核', icon: PackageOpen },
      { href: '/shipments?status=pending', label: '出貨', icon: Truck },
      { href: '/subscriptions', label: '訂閱', icon: Repeat },
      { href: '/settlements', label: '結算', icon: BarChart3 },
    ],
  },
  {
    label: '商品與供應',
    tone: 'master',
    items: [
      { href: '/products', label: '產品', icon: Package },
      { href: '/inventory', label: '庫存', icon: Boxes },
      { href: '/vendors', label: '供應商', icon: Building2 },
      { href: '/restock-requests', label: '補貨', icon: PackageOpen },
    ],
  },
  {
    label: '客戶與通路',
    tone: 'supply',
    items: [
      { href: '/customers', label: '客戶', icon: Users },
      { href: '/merchants', label: '店家', icon: Store },
      { href: '/merchants/shipments', label: '店家出貨', icon: Truck },
      { href: '/merchants/stock', label: '店家庫存', icon: Boxes },
    ],
  },
  {
    label: '活動與計畫',
    tone: 'subscription',
    items: [
      { href: '/mission?plan=jiba', label: '雞霸', icon: Rocket },
      { href: '/mission?plan=jar-exchange', label: '換罐', icon: Gift },
      { href: '/campaigns/jiba-two-piece', label: '活動資料', icon: CalendarClock },
    ],
  },
  {
    label: '設定',
    tone: 'master',
    items: [
      { href: '/account/security', label: '帳號與安全', icon: ListChecks },
    ],
  },
];

export const financeNavGroup: NavGroup = {
  label: '財務',
  tone: 'finance',
  items: [
    { href: '/finance/products', label: '商品毛利', icon: BarChart3 },
    { href: '/finance/channels', label: '通路損益', icon: BarChart3 },
    { href: '/finance/partners', label: '合作店與換罐', icon: Store },
    { href: '/finance/cash-flow', label: '13 週現金流', icon: Wallet },
  ],
};

export function navGroupsForRole(role: string | null | undefined): NavGroup[] {
  if (role !== 'admin') return navGroups;
  return [...navGroups, financeNavGroup];
}
