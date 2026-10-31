'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type QuotationDownloadData = {
  number: string;
  date: string;
  merchant: string;
  contact: string;
  items: { name: string; spec: string; sku: string; quantity: number; price: string; subtotal: string }[];
  subtotal: string;
  discount: string | null;
  shipping: string;
  total: string;
  note: string;
};

/** Draw text using the browser's Chinese fonts, then package full A4 pages as PDF. */
export function QuotationPdfDownloadButton({
  autoStart = false, data,
}: { autoStart?: boolean; data: QuotationDownloadData }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const busy = useRef(false);
  const download = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const { PDFDocument } = await import('pdf-lib');
      await document.fonts.ready;
      const pdf = await PDFDocument.create();
      pdf.setTitle(data.number);
      const width = 1240, height = 1754, margin = 80;
      let canvas: HTMLCanvasElement;
      let ctx: CanvasRenderingContext2D;
      let y = margin;
      function newPage() {
        canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('此瀏覽器無法產生 PDF');
        ctx = context;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#172b23';
        ctx.textBaseline = 'top';
        y = margin;
      }
      async function savePage() {
        const bytes = await (await fetch(canvas!.toDataURL('image/png'))).arrayBuffer();
        const image = await pdf.embedPng(bytes);
        pdf.addPage([595.28, 841.89]).drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
      }
      async function text(value: string, size = 24, bold = false) {
        ctx!.font = `${bold ? '600 ' : ''}${size}px sans-serif`;
        const lines: string[] = [];
        for (const paragraph of value.split('\n')) {
          let line = '';
          for (const char of paragraph) {
            if (line && ctx!.measureText(line + char).width > width - margin * 2) { lines.push(line); line = ''; }
            line += char;
          }
          lines.push(line);
        }
        for (const line of lines) {
          if (y + size * 1.5 > height - margin) {
            await savePage(); newPage();
            ctx!.font = `${bold ? '600 ' : ''}${size}px sans-serif`;
          }
          ctx!.fillText(line, margin, y);
          y += size * 1.5;
        }
        y += 10;
      }
      newPage();
      await text('FURMOSA 買斷報價單', 38, true);
      await text(data.number + '  ' + data.date, 22);
      await text(data.merchant, 30, true);
      if (data.contact) await text(data.contact);
      for (const item of data.items) {
        await text(item.name + (item.spec ? ' · ' + item.spec : ''), 26, true);
        await text('SKU ' + (item.sku || '—') + '   數量 ' + item.quantity);
        await text('買斷單價 ' + item.price + '    小計 ' + item.subtotal);
        y += 12;
      }
      await text('商品小計  ' + data.subtotal);
      if (data.discount) await text('折扣  −' + data.discount);
      await text('運費  ' + data.shipping);
      await text('應收合計  ' + data.total, 32, true);
      if (data.note) await text('備註：' + data.note);
      await text('依訂單確認時保存的成交內容產生', 20);
      await savePage();
      const bytes = await pdf.save();
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = data.number + '.pdf';
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '下載失敗，請重試');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, [data]);
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    void download();
  }, [autoStart, download]);
  return <div>
    <button type="button" disabled={pending} onClick={() => void download()}
      className="inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60 print:hidden">
      {pending ? '產生 PDF 中…' : '下載 PDF'}
    </button>
    {error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}
  </div>;
}
