/** 野放中：官網與社群連結（可用環境變數覆寫） */

function envUrl(key: string, fallback: string): string {
  const v = process.env[key]?.trim();
  return v || fallback;
}

export const FURMOSA_BRAND_LINKS = {
  website: () => envUrl('LINE_BRAND_WEBSITE_URL', 'https://furmosa.pet'),
  instagram: () =>
    envUrl('LINE_BRAND_INSTAGRAM_URL', 'https://www.instagram.com/furmosa_tw/'),
  threads: () => envUrl('LINE_BRAND_THREADS_URL', 'https://www.threads.net/@furmosa_tw'),
  facebook: () =>
    envUrl('LINE_BRAND_FACEBOOK_URL', 'https://www.facebook.com/furmosa.tw'),
  news: () => envUrl('LINE_BRAND_NEWS_URL', 'https://furmosa.pet'),
} as const;
