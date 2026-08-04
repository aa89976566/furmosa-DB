import {
  LayoutDashboard,
  Building2,
  Users,
  Store,
  Package,
  ShoppingCart,
  Boxes,
  Repeat,
  Rocket,
  Gift,
  CalendarClock,
  ListChecks,
  Truck,
  BarChart3,
  PackageOpen,
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
};

/** 高頻在上、訂閱置底（倒數第一） */
export const navGroups: NavGroup[] = [
  {
    label: '總覽',
    tone: 'overview',
    items: [{ href: '/dashboard', label: '儀表板', icon: LayoutDashboard }],
  },
  {
    label: '主資料',
    tone: 'master',
    items: [
      { href: '/vendors', label: '廠商', icon: Building2 },
      { href: '/customers', label: '客戶', icon: Users },
      { href: '/products', label: '產品', icon: Package },
    ],
  },
  {
    label: '訂單',
    tone: 'orders',
    items: [
      { href: '/orders', label: '訂單列表', icon: ShoppingCart },
      { href: '/shipments', label: '出貨隊列', icon: Truck },
      { href: '/restock-requests', label: '補貨申請', icon: Package },
      { href: '/merchants', label: '寄賣', icon: Store },
    ],
  },
  {
    label: '庫存',
    tone: 'inventory',
    items: [
      { href: '/inventory', label: '即時庫存', icon: Boxes },
      { href: '/inventory/transactions', label: '異動紀錄', icon: Boxes },
    ],
  },
  {
    label: '換罐',
    tone: 'supply',
    items: [
      { href: '/jar-exchange/members', label: '會員', icon: Users },
      { href: '/jar-exchange/stores', label: '合作店家', icon: Store },
      { href: '/jar-exchange/flavours', label: '口味與庫存', icon: Package },
      { href: '/jar-exchange/manage?tab=codes', label: '序號', icon: Rocket },
      { href: '/jar-exchange/manage?tab=ledger', label: '點數', icon: Rocket },
      { href: '/jar-exchange/manage?tab=rewards', label: '禮品', icon: Gift },
      { href: '/admin/store-report', label: '核銷報表', icon: BarChart3 },
    ],
  },
  {
    label: '營運',
    tone: 'operations',
    items: [
      {
        href: '/campaigns/jiba-two-piece',
        label: '雞霸開箱',
        icon: PackageOpen,
      },
    ],
  },
  {
    label: '訂閱',
    tone: 'subscription',
    items: [
      { href: '/subscriptions', label: '訂閱合約', icon: Repeat },
      { href: '/subscriptions/shipments', label: '出貨排程', icon: CalendarClock },
      { href: '/subscriptions/plans', label: '訂閱方案', icon: ListChecks },
    ],
  },
];
