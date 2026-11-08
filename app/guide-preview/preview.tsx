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
  const [platform, setPlatform] = useState<'instagram' | 'facebook'>('instagram');
  const [contact, setContact] = useState('');
  const [wishSpecies, setWishSpecies] = useState('');
  const [request, setRequest] = useState('');
  const wishTitle = useRef<HTMLHeadingElement>(null);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (log.current) log.current.scrollTop = wish ? 0 : log.current.scrollHeight;
    if (wish) wishTitle.current?.focus();
  }, [messages, wish, complete]);
  const species = animals.find(([, code]) => code === profile.species)?.[2] ?? profile.species ?? '';
  function reset() {
    setProfile(emptyProfile()); setMessages([{ from: 'guide', text: first }]);
    setChoices(['狗狗', '貓咪', '其他小夥伴']); setInput(''); setWish(false); setComplete(false); setClosed(false);
    setPlatform('instagram'); setContact(''); setWishSpecies(''); setRequest('');
  }
  function send(text: string) {
    if (!text.trim()) return;
    if (text === '留下許願') { setWishSpecies(species); setWish(true); return; }
    const parsed = understand(text);
    if (profile.species === 'other' && !parsed.profile.species) parsed.profile.species = text.trim();
    const result = nextTurn(profile, parsed, []);
    setProfile(result.profile);
    const reply = result.action === 'wish' ? '示範目錄尚未載入正式商品。可以先體驗許願池，留下想找的東西，並選擇 Instagram 或 Facebook 聯絡方式。' : result.reply;
    setMessages(previous => [...previous, { from: 'user', text }, { from: 'guide', text: reply }]);
    setChoices(result.action === 'wish' ? ['留下許願'] : result.choices);
    setWish(false); setComplete(false); setInput('');
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setComplete(true); }
  return <main className="guide-demo">
    <p className="demo-note">互動示範・尚未連接 AI 與 HQ，填寫內容不會送出或儲存</p>
    {closed ? <button className="reopen" onClick={() => setClosed(false)}>開啟匠子導購</button> : <section className="shell" aria-label="匠寵導購示範">
      <header><strong>FURMOSA 匠寵</strong><button aria-label="關閉導購" onClick={() => setClosed(true)}>×</button></header>
      <div className="toolbar"><span>{species ? `正在幫${species}找` : '匠子陪你找'}</span>{wish ? <button onClick={() => setWish(false)}>返回對話</button> : <button onClick={reset}>重新開始</button>}</div>
      <div ref={log} className={`conversation${wish ? ' wishing' : ''}`} role={wish ? 'region' : 'log'} aria-label={wish ? '許願池表單' : '導購對話'}>
        {/* Reuse the existing Shopify artwork without cropping or redrawing. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="blue-companion" src="https://cdn.shopify.com/s/files/1/0989/6316/1465/files/furmosa-blue-companion-1030.png?v=1793361481" alt="戴黃色耳機的抽象長身藍狗" width={2172} height={724} />
        {wish && <div className="pool-art" aria-hidden="true"><span>✦</span><i /><span>✧</span></div>}
        {!wish && messages.map((message, index) => <p className={message.from} key={index}>{message.text}</p>)}
        {!wish && <div className="choices">{choices.map(choice => <button key={choice} onClick={() => send(choice)}>{choice}</button>)}</div>}
        {wish && <section className="wish"><h1 ref={wishTitle} tabIndex={-1}>許願池</h1><p className="wish-subtitle">想找的好東西，留給我們。</p>
          {complete ? <div role="status"><h2>示範填寫完成</h2><p>這筆許願沒有送出，HQ 不會收到通知。</p><button onClick={reset}>再試一次</button></div> : <form onSubmit={submit}>
            <label>幫誰許願？<input className="species-chip" name="species" required maxLength={40} value={wishSpecies} onChange={event => setWishSpecies(event.target.value)} aria-label="許願的動物，可直接修改" /></label>
            <label>想找什麼？<textarea name="request" required minLength={2} maxLength={500} value={request} onChange={event => setRequest(event.target.value)} placeholder="例如：兔兔可以玩的藏食玩具" /></label>
            <fieldset className="contact-platform"><legend>希望用哪個方式聯絡？</legend><div>
              {(['instagram', 'facebook'] as const).map(value => <label key={value} className={platform === value ? 'selected' : ''}><input type="radio" name="platform" value={value} checked={platform === value} onChange={() => { setPlatform(value); setContact(''); }} />{value === 'instagram' ? 'Instagram' : 'Facebook'}</label>)}
            </div></fieldset>
            <label className="contact-input"><span className="sr-only">{platform === 'instagram' ? 'Instagram' : 'Facebook'} 帳號或個人檔案連結</span><input name="contact" required maxLength={200} value={contact} onChange={event => setContact(event.target.value)} placeholder={platform === 'instagram' ? 'Instagram 帳號或個人檔案連結' : 'Facebook 個人檔案連結'} autoComplete="off" /></label>
            <p className="hint">有合適的好物，我們會透過私訊聯絡你。</p>
            <button className="submit" type="submit">把願望放進池裡 <svg aria-hidden="true" width="32" height="28" viewBox="0 0 40 32" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17 13 27H31L37 17 20 21 3 17Z M12 18 20 3 30 18 M20 3V21" /></svg></button>
            <p className="hint preview-hint">此為預覽示範，不會送出或聯繫你。</p>
          </form>}
        </section>}
        {!choices.length && !wish && <button className="restart" onClick={reset}>重新挑選</button>}
      </div>
      {!wish && <form className="composer" onSubmit={event => { event.preventDefault(); send(input); }}><input aria-label="告訴匠子想找什麼" value={input} onChange={event => setInput(event.target.value)} placeholder="直接告訴匠子你想找什麼" maxLength={500} /><button aria-label="送出訊息" disabled={!input.trim()}>↗</button></form>}
    </section>}
    <style>{`
      .conversation.wishing{border:0;border-radius:0;padding:10px 4px 24px}.wishing .blue-companion{max-width:380px;margin:0 auto;width:85%}.pool-art{height:35px;max-width:380px;margin:-10px auto 10px;position:relative;color:#ffd346;display:flex;justify-content:space-between;font-size:28px}.pool-art i{position:absolute;left:10%;right:10%;height:24px;border:2px solid #88abe0;border-radius:50%;transform:rotate(-2deg)}.pool-art i:after{content:'';position:absolute;width:60px;height:10px;border-bottom:2px solid #88abe0;border-radius:50%;left:35%;top:2px}
      .wishing .wish h1{text-align:center;font-size:clamp(36px,7vw,48px);font-weight:800;letter-spacing:5px;line-height:1.3;outline:none;margin:8px 0}.wish .wish-subtitle{text-align:center;font-weight:600;font-size:18px;margin-bottom:24px}.wish form{border:2px solid #88abe0;border-radius:38px 34px 42px 30px;padding:22px}.wish form>label{font-weight:650;margin:0 0 22px}.wish input.species-chip{background:#ffe268;border-color:#ffe268;border-radius:40px;width:145px;text-align:center;font-size:20px;font-weight:700}.wish .contact-platform{border:0;padding:0;margin:0 0 12px;min-width:0}.contact-platform legend{font-weight:650;margin-bottom:10px;font-size:16px}.contact-platform>div{display:flex;gap:10px}.wish .contact-platform label{position:relative;flex:1;border:2px solid #81a9df;border-radius:32px;padding:12px 8px;margin:0;text-align:center;font-weight:700;cursor:pointer;min-width:0}.wish .contact-platform label.selected{background:#ffe268;border-color:#ffe268}.wish .contact-platform input{position:absolute;inset:0;opacity:0;cursor:pointer;margin:0;width:100%;height:100%}.contact-platform label:focus-within{outline:3px solid #377fd3;outline-offset:3px}.wish form .contact-input{margin-bottom:10px}.wish .hint{line-height:1.7;margin-bottom:16px}.wish form .submit{width:100%;display:flex;align-items:center;justify-content:center;gap:14px;padding:16px 12px;border-radius:48px;font-size:clamp(18px,4vw,23px);font-weight:800}.wish .preview-hint{text-align:center;margin:12px 0 0;font-size:12px}.wish input:focus-visible,.wish textarea:focus-visible,.wish button:focus-visible{outline:3px solid #377fd3;outline-offset:3px}@media(max-width:600px){.wish form{padding:20px 16px;border-radius:30px}.wish .contact-platform label{font-size:15px}.wish .wish-subtitle{font-size:16px}.wishing .blue-companion{width:90%}}
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
