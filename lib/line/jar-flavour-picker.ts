import type { LineReplyMessage } from '@/lib/line/reply';
import { buildJarDialogueBubble } from '@/lib/line/jar-dialogue-shell';
import type { RefillFlavourView } from '@/lib/jar-exchange/refill-flavours';
import { isValidJarCodeFormat, normalizeJarCode } from '@/lib/jar-exchange/codes';

/** postback：jd=jar_fl&c={code}&f={flavourCode} */
export function buildJarFlavourPostbackData(code: string, flavourCode: string): string {
  return `jd=jar_fl&c=${encodeURIComponent(code)}&f=${encodeURIComponent(flavourCode)}`;
}

export function buildJarFlavourPickerMessages(opts: {
  code: string;
  flavours: RefillFlavourView[];
}): LineReplyMessage[] {
  const code = normalizeJarCode(opts.code);
  const flavours = opts.flavours.slice(0, 10);

  if (!code || !isValidJarCodeFormat(code) || flavours.length === 0) {
    return [
      {
        type: 'text',
        text: '目前沒有可選口味，請稍後再試，或跟店員確認本期品項。',
      },
    ];
  }

  const buttons = flavours.map((f) => ({
    type: 'button' as const,
    style: 'secondary' as const,
    height: 'sm' as const,
    action: {
      type: 'postback' as const,
      label: f.name.slice(0, 20),
      data: buildJarFlavourPostbackData(code, f.code),
      displayText: f.name,
    },
  }));

  return [
    {
      type: 'text',
      text: `序號 ${code} 可以入罐囉。\n請選這次帶回／換到的口味，訂單才會記對商品。`,
    },
    {
      type: 'flex',
      altText: '選擇換罐口味',
      contents: buildJarDialogueBubble({
        spacing: 'sm',
        bodyContents: [
          {
            type: 'text',
            text: '這次拿了哪一味？',
            weight: 'bold',
            size: 'lg',
          },
          {
            type: 'text',
            text: `序號 ${code}`,
            size: 'xs',
            color: '#888888',
            wrap: true,
          },
          {
            type: 'text',
            text: '選錯可以再跟店員說；先選最接近的就好。',
            size: 'sm',
            wrap: true,
            color: '#666666',
          },
          ...buttons,
        ],
      }),
    },
  ];
}
