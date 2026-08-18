import { PREVIEW_BANNER_PRIMARY, PREVIEW_BANNER_SECONDARY } from '@/lib/merchant-pos-preview/copy';

export function PreviewBanner() {
  return (
    <div
      role="status"
      className="border-b border-warning/30 bg-warning/10 px-4 py-3 text-navy"
    >
      <p className="text-center text-xs font-semibold tracking-wide sm:text-sm">
        {PREVIEW_BANNER_PRIMARY}
      </p>
      <p className="mt-1 text-center text-xs text-navy/80">{PREVIEW_BANNER_SECONDARY}</p>
    </div>
  );
}
