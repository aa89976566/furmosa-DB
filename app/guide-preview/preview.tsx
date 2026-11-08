'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { emptyProfile, nextTurn } from '../../lib/guide/conversation';
import type { Profile, Understanding } from '../../lib/guide/conversation';

type Message = { from: 'user' | 'guide'; text: string };
const first = '這次想幫哪位小夥伴找？也可以直接告訴我物種和想找的東西。';
const animals: Array<[RegExp, string, string]> = [
  [/兔/, 'rabbit', '兔兔'], [/天竺鼠/, 'guinea_pig', '天竺鼠'], [/倉鼠/, 'hamster', '倉鼠'],
  [/鳥|鸚鵡/, 'bird', '鳥寶'], [/狗|犬/, 'dog', '狗狗'], [/貓/, 'cat', '貓咪'],
];
// Local deterministic preview only; no API call, customer data or product claims.
function understand(text: string): Understanding {
  const profile = emptyProfile();
  profile.species = animals.find(([pattern]) => pattern.test(text))?.[1] ?? (text === '其他小夥伴' ? 'other' : null);
  if (/吃|零食|訓練|主食/.test(text)) profile.category = 'food';
  if (/玩|磨牙|啃咬|放電|互動/.test(text)) profile.category = 'toy';
  if (/照護|清潔|餐碗|飲水|外出/.test(text)) profile.category = 'care';
  const purposes: Array<[RegExp, string]> = [[/訓練/, 'training'], [/零食/, 'snack'], [/主食/, 'meal'], [/磨牙|啃咬/, 'chewing'], [/放電/, 'indoor_play'], [/互動/, 'interactive_play'], [/清潔/, 'cleaning'], [/餐碗|飲水/, 'feeding'], [/外出/, 'outdoor']];
  profile.need = purposes.find(([pattern]) => pattern.test(text))?.[1] ?? null;
  if (/不吃雞|避.*雞|雞肉過敏/.test(text)) profile.avoid = ['chicken'];
  return { profile, shopping: true, medical: /治療|生病|嘔吐|拉肚子/.test(text), clearAvoid: false, clearRequirements: false };
}

export default function GuidePreview() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [messages, setMessages] = useState<Message[]>([{ from: 'guide', text: first }]);
  const [choices, setChoices] = useState(['狗狗', '貓咪', '其他小夥伴']);
  const [input, setInput] = useState('');
  const [wish, setWish] = useState(false);
  const [complete, setComplete] = useState(false);
  const [closed, setClosed] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, wish, complete]);
  const species = animals.find(([, code]) => code === profile.species)?.[2] ?? profile.species ?? '';
  function reset() {
    setProfile(emptyProfile()); setMessages([{ from: 'guide', text: first }]);
    setChoices(['狗狗', '貓咪', '其他小夥伴']); setInput(''); setWish(false); setComplete(false); setClosed(false);
  }
  function send(text: string) {
    if (!text.trim()) return;
    if (text === '留下許願') { setWish(true); setChoices([]); return; }
    const parsed = understand(text);
    if (profile.species === 'other' && !parsed.profile.species) parsed.profile.species = text.trim();
    const result = nextTurn(profile, parsed, []);
    setProfile(result.profile);
    const reply = result.action === 'wish' ? '示範目錄尚未載入正式商品。你可以先體驗許願：留下想找的東西和 LINE ID，看看送出前的表單。' : result.reply;
    setMessages(previous => [...previous, { from: 'user', text }, { from: 'guide', text: reply }]);
    setChoices(result.action === 'wish' ? ['留下許願'] : result.choices);
    setWish(false); setComplete(false); setInput('');
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setComplete(true); }
  return <main className="guide-demo">
    <p className="demo-note">互動示範・尚未連接 AI 與 HQ，填寫內容不會送出或儲存</p>
    {closed ? <button className="reopen" onClick={() => setClosed(false)}>開啟匠子導購</button> : <section className="shell" aria-label="匠寵導購示範">
      <header><strong>FURMOSA 匠寵</strong><button aria-label="關閉導購" onClick={() => setClosed(true)}>×</button></header>
      <div className="toolbar"><span>{species ? `正在幫${species}找` : '匠子陪你找'}</span><button onClick={reset}>重新開始</button></div>
      <div ref={log} className="conversation" role="log" aria-live="polite">
        {/* Reuse the existing Shopify artwork without cropping or redrawing. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="blue-companion" src="https://cdn.shopify.com/s/files/1/0989/6316/1465/files/furmosa-blue-companion-1030.png?v=1793361481" alt="戴黃色耳機的抽象長身藍狗" width={2172} height={724} />
        {messages.map((message, index) => <p className={message.from} key={index}>{message.text}</p>)}
        {!wish && <div className="choices">{choices.map(choice => <button key={choice} onClick={() => send(choice)}>{choice}</button>)}</div>}
        {wish && <section className="wish"><h1>許願池</h1><p>想找的東西，先留給我們。</p>
          {complete ? <div role="status"><h2>示範填寫完成</h2><p>這筆許願沒有送出，HQ 不會收到通知。</p><button onClick={reset}>再試一次</button></div> : <form onSubmit={submit}>
            <label>幫哪位小夥伴找<input name="species" required maxLength={40} defaultValue={species} /></label>
            <label>想找什麼？<textarea name="request" required minLength={2} maxLength={500} placeholder="例如：兔兔可以玩的藏食玩具" /></label>
            <label>你的 LINE ID<input name="line" required pattern="[A-Za-z0-9_.\-]{4,20}" placeholder="請填 LINE ID，不是顯示名稱" autoComplete="off" /></label>
            <p className="hint">正式啟用後，匠寵會透過這個 LINE ID 加你好友，回覆這次許願。此處為示範，不會聯繫你。</p>
            <button className="submit" type="submit">完成示範填寫</button>
          </form>}
        </section>}
        {!choices.length && !wish && <button className="restart" onClick={reset}>重新挑選</button>}
      </div>
      <form className="composer" onSubmit={event => { event.preventDefault(); send(input); }}><input aria-label="告訴匠子想找什麼" value={input} onChange={event => setInput(event.target.value)} placeholder="直接告訴匠子你想找什麼" maxLength={500} /><button aria-label="送出訊息" disabled={!input.trim()}>↗</button></form>
    </section>}
    <style>{`
      .blue-companion{display:block;width:100%;height:auto;object-fit:contain;margin:0 auto 24px;max-width:550px}
      .guide-demo{min-height:100dvh;background:#f0e9d9;color:#192c59;padding:20px;font-family:Arial,"Noto Sans TC",sans-serif}
      .guide-demo *{box-sizing:border-box}.demo-note{max-width:740px;margin:0 auto 12px;font-size:13px;line-height:1.6;color:#425878}
      .shell{max-width:740px;height:min(820px,calc(100dvh - 75px));min-height:450px;margin:auto;background:#fffcf5;border-radius:28px;padding:24px;display:flex;flex-direction:column;box-shadow:0 16px 70px #273e5920}
      .shell header{display:flex;align-items:center;justify-content:space-between;gap:12px}.shell strong{font-size:25px;letter-spacing:1px}.shell button,.reopen{font:inherit;cursor:pointer;color:inherit}.shell header button{width:44px;height:44px;border:0;border-radius:50%;background:#fff6dc;color:#32647a;font-size:32px}
      .toolbar{display:flex;justify-content:space-between;align-items:center;margin:16px 0;font-size:14px}.toolbar button{border:0;background:none;text-decoration:underline;color:#32647a}.conversation{flex:1;overflow:auto;border:2px solid #88abe0;border-radius:54px 58px 60px 48px;padding:26px;overscroll-behavior:contain;min-height:0}.conversation p{line-height:1.8;margin:0 0 20px;font-size:18px;white-space:pre-wrap;overflow-wrap:anywhere}.conversation .user{background:#ffe268;border-radius:25px 8px 25px 25px;padding:12px 18px;margin-left:auto;width:fit-content;max-width:85%}.conversation .guide{max-width:95%}.choices{display:flex;flex-wrap:wrap;gap:12px;margin:22px 0}.choices button,.restart,.wish button{background:transparent;border:2px solid #81a9df;border-radius:30px;padding:14px 24px;min-height:48px;font-weight:600}.choices button:hover,.choices button:focus-visible{background:#fff0b5}.composer{display:flex;gap:12px;padding-top:18px;align-items:center}.composer input{min-width:0;flex:1;height:56px;background:#fffefa;border:2px solid #377fd3;border-radius:40px;padding:0 20px;font:inherit;color:#192c59}.composer button{flex-shrink:0;border:0;border-radius:50%;width:56px;height:56px;background:#377fd3;color:white;font-size:35px}.composer button:disabled{opacity:.5}.wish h1{font-size:28px;margin:8px 0}.wish label{display:block;font-size:16px;margin:14px 0}.wish input,.wish textarea{display:block;width:100%;margin-top:8px;padding:12px;border:1.5px solid #88abe0;border-radius:14px;background:#fffefa;font:inherit;color:inherit}.wish textarea{min-height:96px;resize:vertical}.wish .hint{font-size:13px;color:#425878}.wish .submit{background:#ffe268;border-color:#ffe268}.reopen{display:block;margin:80px auto;padding:20px;border:2px solid #81a9df;border-radius:30px;background:#fffcf5}
      @media(max-width:600px){.guide-demo{padding:10px}.shell{height:calc(100dvh - 76px);min-height:360px;padding:16px;border-radius:22px}.shell strong{font-size:21px}.conversation{padding:20px 16px;border-radius:35px}.conversation p{font-size:16px}.choices{gap:8px}.choices button{padding:12px 18px}.composer input{padding:0 14px;font-size:15px}.demo-note{font-size:12px}.toolbar{margin:12px 0}}
    `}</style>
  </main>;
}
