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
  collapsible?: boolean;
};

export const navGroups: NavGroup[] = [
  {
    label: '每天工作',
    tone: 'operations',
    items: [
      { href: '/dashboard', label: '首頁', icon: LayoutDashboard },
      {
        href: '/reviews',
        label: '待審核',
        icon: PackageOpen,
      },
      { href: '/orders', label: '訂單', icon: ShoppingCart },
      { href: '/shipments', label: '出貨', icon: Truck },
      { href: '/tasks', label: '任務', icon: CheckSquare },
    ],
  },
  {
    label: '客戶與商品',
    tone: 'master',
    items: [
      { href: '/customers', label: '客戶', icon: Users },
      { href: '/products', label: '產品', icon: Package },
      { href: '/inventory', label: '庫存', icon: Boxes },
    ],
  },
  {
    label: '店家與供應',
    tone: 'orders',
    collapsible: true,
    items: [
      { href: '/merchants', label: '寄賣', icon: Store },
      { href: '/restock-requests', label: '補貨', icon: Package },
      { href: '/vendors', label: '廠商', icon: Building2 },
      { href: '/inventory/transactions', label: '庫存紀錄', icon: Boxes },
    ],
  },
  {
    label: '訂閱制',
    tone: 'subscription',
    collapsible: true,
    items: [
      { href: '/subscriptions', label: '訂閱合約', icon: Repeat },
      { href: '/subscriptions/shipments', label: '出貨排程', icon: CalendarClock },
      { href: '/subscriptions/plans', label: '訂閱方案', icon: ListChecks },
    ],
  },
  {
    label: '換罐會員',
    tone: 'supply',
    collapsible: true,
    items: [
      { href: '/jar-exchange/members', label: '會員列表', icon: Users },
      { href: '/jar-exchange/stores', label: '合作店家', icon: Store },
      { href: '/jar-exchange/flavours', label: '口味與庫存', icon: Package },
      { href: '/jar-exchange/manage?tab=codes', label: '序號管理', icon: Rocket },
      { href: '/jar-exchange/manage?tab=ledger', label: '點數帳本', icon: Rocket },
      { href: '/jar-exchange/manage?tab=rewards', label: '禮品兌換', icon: Gift },
      { href: '/admin/store-report', label: '店家核銷報表', icon: BarChart3 },
    ],
  },
];
