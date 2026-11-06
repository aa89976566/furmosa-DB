'use client';

import { useState } from 'react';

export function ProductCover({
  name,
  imageUrl,
  imgClassName,
  markClassName,
}: {
  name: string;
  imageUrl: string | null;
  imgClassName?: string;
  markClassName?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!imageUrl || failedUrl === imageUrl) {
    return (
      <span className={markClassName} aria-hidden>
        {name.slice(0, 1)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt=""
      className={imgClassName}
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(imageUrl)}
    />
  );
}
