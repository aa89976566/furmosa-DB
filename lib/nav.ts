import {
  LayoutDashboard,
  Building2,
  Users,
  Store,
  Package,
  Warehouse,
  ShoppingCart,
  Boxes,
  Coins,
  Gift,
  CheckSquare,
  Repeat,
  CalendarClock,
  ListChecks,
  Truck,
  Search,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: '總覽',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: '主資料 Master Data',
    items: [
      { href: '/vendors', label: '廠商', icon: Building2 },
      { href: '/customers', label: '客戶', icon: Users },
      { href: '/merchants', label: '寄賣店家', icon: Store },
      { href: '/products', label: '產品', icon: Package },
      { href: '/products/lookup', label: '價格查詢', icon: Search },
      { href: '/warehouses', label: '倉庫', icon: Warehouse },
    ],
  },
  {
    label: '訂單 Order Hub',
    items: [
      { href: '/orders', label: '訂單列表', icon: ShoppingCart },
      { href: '/shipments', label: '出貨隊列', icon: Truck },
    ],
  },
  {
    label: '訂閱制 Subscription',
    items: [
      { href: '/subscriptions', label: '訂閱合約', icon: Repeat },
      { href: '/subscriptions/shipments', label: '出貨排程', icon: CalendarClock },
      { href: '/subscriptions/plans', label: '訂閱方案', icon: ListChecks },
    ],
  },
  {
    label: '庫存 Inventory',
    items: [
      { href: '/inventory', label: '即時庫存', icon: Boxes },
      { href: '/inventory/transactions', label: '異動紀錄', icon: Boxes },
    ],
  },
  {
    label: '換罐會員 Loyalty',
    items: [
      { href: '/points', label: '點數帳本', icon: Coins },
      { href: '/rewards', label: '兌換商品', icon: Gift },
      { href: '/redemptions', label: '兌換紀錄', icon: Gift },
    ],
  },
  {
    label: '營運任務',
    items: [{ href: '/tasks', label: '任務看板', icon: CheckSquare }],
  },
];
