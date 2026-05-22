import {
  LayoutDashboard,
  Building2,
  Users,
  Store,
  Package,
  ShoppingCart,
  Boxes,
  Coins,
  Gift,
  CheckSquare,
  Repeat,
  CalendarClock,
  ListChecks,
  Truck,
  History,
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

export const navGroups: NavGroup[] = [
  {
    label: '總覽',
    tone: 'overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: '主資料 Master Data',
    tone: 'master',
    items: [
      { href: '/vendors', label: '廠商', icon: Building2 },
      { href: '/customers', label: '客戶', icon: Users },
      { href: '/merchants', label: '寄賣店家', icon: Store },
      { href: '/products', label: '產品', icon: Package },
    ],
  },
  {
    label: '訂單 Order Hub',
    tone: 'orders',
    items: [
      { href: '/orders', label: '訂單列表', icon: ShoppingCart },
      { href: '/shipments', label: '出貨隊列', icon: Truck },
      { href: '/shipments/history', label: '出貨歷史', icon: History },
      { href: '/orders/history', label: '歷史訂單', icon: History },
    ],
  },
  {
    label: '訂閱制 Subscription',
    tone: 'subscription',
    items: [
      { href: '/subscriptions', label: '訂閱合約', icon: Repeat },
      { href: '/subscriptions/shipments', label: '出貨排程', icon: CalendarClock },
      { href: '/subscriptions/plans', label: '訂閱方案', icon: ListChecks },
    ],
  },
  {
    label: '庫存 Inventory',
    tone: 'inventory',
    items: [
      { href: '/inventory', label: '即時庫存', icon: Boxes },
      { href: '/inventory/transactions', label: '異動紀錄', icon: Boxes },
    ],
  },
  {
    label: '換罐會員 Loyalty',
    tone: 'loyalty',
    items: [
      { href: '/points', label: '點數帳本', icon: Coins },
      { href: '/rewards', label: '兌換商品', icon: Gift },
      { href: '/redemptions', label: '兌換紀錄', icon: Gift },
    ],
  },
  {
    label: '營運任務',
    tone: 'operations',
    items: [{ href: '/tasks', label: '任務看板', icon: CheckSquare }],
  },
];
