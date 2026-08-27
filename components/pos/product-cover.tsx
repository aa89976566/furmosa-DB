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
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
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
      onError={() => setFailed(true)}
    />
  );
}
