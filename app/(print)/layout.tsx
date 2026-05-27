/**
 * 列印專用版面：不含側欄與 Topbar
 */
export default function PrintRouteLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-neutral-100">{children}</div>;
}
