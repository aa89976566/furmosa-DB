/** Evidence excerpts, never inferred prices or commercial commitments. HTML is never rendered. */
export function summarizeReply(contents: string[]): string {
  const text = contents.join('\n').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<(?:br|\/p|\/div|\/tr)[^>]*>/gi, '\n').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
  const lines = text.split(/\n+/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const fields: [string, RegExp][] = [
    ['MOQ', /\bmoq\b|minimum.*(?:order|quantity)/i],
    ['批發價／數量價格', /wholesale|price|pricing|\b(?:50|100|300)\b|\$|€|usd/i],
    ['物流／箱規／交期', /shipping|freight|carton|weight|dimension|lead time|delivery/i],
    ['代理區域', /distribut|exclusive|territor|taiwan|hong kong/i],
    ['授權／自有品牌', /licen[cs]|permission|media|image|private label|white label/i],
    ['付款條件', /payment|deposit|net \d|bank transfer/i],
  ];
  return ['品牌回覆重點（原文摘錄；請開啟完整往來確認，引用的舊信可能包含在內）',
    ...fields.map(([label, re]) => `${label}：${lines.filter(s => re.test(s)).slice(0, 3).join(' / ').slice(0, 900) || '未辨識到明確資訊'}`),
    '下一步：核對完整回覆與報價；補問缺漏條件，再決定是否索樣。自動追信已停止。'].join('\n\n');
}
