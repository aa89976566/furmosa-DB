import Link from 'next/link';

export function PosReceiptSupport() {
  return (
    <div className="rounded-xl border border-dashed bg-background/70 p-3 text-sm">
      <p className="font-medium">商品有問題？先不要確認收貨</p>
      <p className="mt-1 text-muted-foreground">
        品項、數量或商品狀況不符，請聯絡匠寵官方客服協助處理。
      </p>
      <Link
        href="https://line.me/R/ti/p/@furmosa_food"
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
      >
        LINE 聯絡客服 @furmosa_food
      </Link>
    </div>
  );
}
