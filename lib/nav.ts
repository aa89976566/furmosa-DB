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
  Activity,
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
      { href: '/products', label: '產品', icon: Package },
    ],
  },
  {
    label: '訂單 Order Hub',
    tone: 'orders',
    items: [
      { href: '/orders', label: '訂單列表', icon: ShoppingCart },
      { href: '/shipments', label: '出貨隊列', icon: Truck },
      { href: '/restock-requests', label: '補貨申請', icon: Package },
      { href: '/merchants', label: '寄賣', icon: Store },
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
    label: '換罐會員',
    tone: 'supply',
    items: [
      { href: '/jar-exchange/ops', label: '營運台', icon: Activity },
      { href: '/jar-exchange/members', label: '會員列表', icon: Users },
      { href: '/jar-exchange/stores', label: '合作店家', icon: Store },
      { href: '/jar-exchange/manage?tab=codes', label: '序號管理', icon: Rocket },
      { href: '/jar-exchange/manage?tab=ledger', label: '點數帳本', icon: Rocket },
      { href: '/jar-exchange/manage?tab=rewards', label: '禮品兌換', icon: Gift },
      { href: '/admin/store-report', label: '店家核銷報表', icon: BarChart3 },
    ],
  },
  {
    label: '營運任務',
    tone: 'operations',
    items: [{ href: '/tasks', label: '任務看板', icon: CheckSquare }],
  },
];
