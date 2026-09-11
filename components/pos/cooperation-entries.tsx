import Link from 'next/link';
import { Recycle, ShoppingBag, Users, ArrowUpRight } from 'lucide-react';

const entries = [
  { href: '/pos/refill', title: '換罐計畫', description: '掃描罐底、查詢客人與處理換罐', icon: Recycle },
  { href: '/pos/sell', title: '寄賣銷售', description: '選購商品，依既有售價與分潤規則記錄銷售', icon: ShoppingBag },
  { href: '/pos/group-buy', title: '活動／團購', description: '查看店家專屬進貨價與合作資訊', icon: Users },
];

export function CooperationEntries() {
  return <section aria-label="合作模式" className="grid gap-3 lg:grid-cols-3">
    {entries.map(({ href, title, description, icon: Icon }) => (
      <Link key={href} href={href} className="group rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900">
        <div className="mb-4 flex items-center justify-between"><Icon className="h-6 w-6" aria-hidden /><ArrowUpRight className="h-5 w-5 text-zinc-400 group-hover:text-zinc-900" aria-hidden /></div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
      </Link>
    ))}
  </section>;
}
