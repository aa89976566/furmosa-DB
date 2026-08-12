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

/**
 * HQ 側欄 IA — 對齊 Experience Bible H-02 與 POS／LINE 任務流：
 * 先「今天營運」，再店家／換罐，主資料與報表往後放。
 */
export const navGroups: NavGroup[] = [
  {
    label: '今天營運',
    tone: 'overview',
    items: [
      { href: '/dashboard', label: '今天營運', icon: LayoutDashboard },
      { href: '/restock-requests', label: '補貨申請', icon: Package },
      { href: '/shipments', label: '出貨隊列', icon: Truck },
    ],
  },
  {
    label: '店家與寄賣',
    tone: 'orders',
    items: [
      { href: '/merchants', label: '寄賣店家', icon: Store },
      { href: '/orders', label: '訂單列表', icon: ShoppingCart },
    ],
  },
  {
    label: '換罐與 LINE',
    tone: 'supply',
    items: [
      { href: '/jar-exchange/members', label: '換罐會員', icon: Users },
      { href: '/jar-exchange/stores', label: '合作店家', icon: Store },
      { href: '/jar-exchange/flavours', label: '口味與庫存', icon: Package },
      { href: '/jar-exchange/manage?tab=codes', label: '序號管理', icon: Rocket },
      { href: '/jar-exchange/manage?tab=ledger', label: '點數帳本', icon: Rocket },
      { href: '/jar-exchange/manage?tab=rewards', label: '禮品兌換', icon: Gift },
      {
        href: '/campaigns/jiba-two-piece',
        label: '雞霸開箱審核',
        icon: PackageOpen,
      },
      { href: '/admin/store-report', label: '店家核銷報表', icon: BarChart3 },
    ],
  },
  {
    label: '訂閱制',
    tone: 'subscription',
    items: [
      { href: '/subscriptions', label: '訂閱合約', icon: Repeat },
      { href: '/subscriptions/shipments', label: '出貨排程', icon: CalendarClock },
      { href: '/subscriptions/plans', label: '訂閱方案', icon: ListChecks },
    ],
  },
  {
    label: '庫存與主資料',
    tone: 'inventory',
    items: [
      { href: '/inventory', label: '即時庫存', icon: Boxes },
      { href: '/inventory/transactions', label: '異動紀錄', icon: Boxes },
      { href: '/products', label: '產品', icon: Package },
      { href: '/customers', label: '客戶', icon: Users },
      { href: '/vendors', label: '廠商', icon: Building2 },
    ],
  },
  {
    label: '其他',
    tone: 'operations',
    items: [{ href: '/tasks', label: '任務看板', icon: CheckSquare }],
  },
];
