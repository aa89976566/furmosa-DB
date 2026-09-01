import * as React from 'react';

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href?: string | { pathname?: string };
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
  locale?: string;
};

export default function Link({ href, children, prefetch, replace, scroll, shallow, locale, ...rest }: LinkProps) {
  const url = typeof href === 'string' ? href : href?.pathname ?? '#';
  return (
    <a href={url} {...rest}>
      {children}
    </a>
  );
}
