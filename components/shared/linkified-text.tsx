import React from 'react';

const URL_SPLIT_RE = /(https?:\/\/[^\s]+)/gi;

/** 將文字中的網址改為短標題連結，避免長網址撐破版面 */
export function LinkifiedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts = text.split(URL_SPLIT_RE).filter((s) => s.length > 0);

  const linkLabel = (url: string) => {
    const lower = url.toLowerCase();
    if (
      lower.includes('maps.google') ||
      lower.includes('google.com/maps') ||
      lower.includes('goo.gl')
    )
      return 'Google 地圖連結';
    return '開啟連結';
  };

  return (
    <span className={className}>
      {parts.map((part, index) =>
        /^https?:\/\//i.test(part) ? (
          <a
            key={`${index}-${part.slice(0, 40)}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-info underline underline-offset-2 hover:text-info/90"
          >
            {linkLabel(part)}
          </a>
        ) : (
          <React.Fragment key={`${index}-t`}>{part}</React.Fragment>
        ),
      )}
    </span>
  );
}
