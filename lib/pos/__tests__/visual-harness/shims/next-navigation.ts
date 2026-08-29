export function usePathname() {
  return '/pos/records';
}

export function useRouter() {
  return {
    push() {},
    replace() {},
    prefetch() {},
    back() {},
    forward() {},
    refresh() {},
  };
}

export function useSearchParams() {
  return new URLSearchParams();
}
