'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { submitBooking } from './actions';
import { BookingCalendar } from './booking-calendar';
import styles from './booking-progress.module.css';

const inputClass = 'mt-1 min-h-11 w-full rounded-lg border border-[#ded9cf] bg-white px-3 py-2 text-base';
const halfHourTimes = Array.from({ length: 48 }, (_, index) =>
  String(Math.floor(index / 2)).padStart(2, '0') + (index % 2 === 0 ? ':00' : ':30'));
const services = [
  { label: '健康在世', live: 1200, written: 1000 },
  { label: '高齡／重症／長照／安寧', live: 1400, written: 1200 },
  { label: '離世天使', live: 1800, written: 1600 },
] as const;

export function BookingForm({ today }: { today: string }) {
  const [format, setFormat] = useState<'live' | 'written'>('live');
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [candidate, setCandidate] = useState(0);
  const [pickingTime, setPickingTime] = useState(false);
  const [slots, setSlots] = useState([{ date: '', time: '' }, { date: '', time: '' }]);
  const [confirmed, setConfirmed] = useState([false, false]);
  const [delivery, setDelivery] = useState('');
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [lineId, setLineId] = useState('');
  const [checkout, setCheckout] = useState<{ reference: string; variantId: string; cartProperties: Record<string, string> } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const candidateValues = slots.map(({ date, time }) => date && time ? date + 'T' + time : '');
  const slot = slots[candidate];
  const choosingDate = step === 1 && (format === 'written' || !pickingTime);
  const progressLabels = format === 'live'
    ? ['選服務', '選首選', '選備用', '填 LINE', '購物袋']
    : ['選服務', '選交付日', '填 LINE', '購物袋'];
  const currentProgress = format === 'live' ? (step === 1 ? 1 + candidate : step === 0 ? 0 : step + 1) : step;
  const currentProgressLabel = step === 3 ? '加入購物袋' : progressLabels[currentProgress];
  const completed = confirmed.filter(Boolean).length;
  const candidateLabel = candidate === 0 ? '首選' : '備用';
  const title = step === 3 ? '確認預約資料' : step === 0 ? '選擇服務' : step === 2 ? (format === 'live' ? '兩組時段已選好' : '填寫 LINE') :
    format === 'written' ? '選擇期望交付日' : (candidate === 1 && !pickingTime ? '再選一個備用日期' : '選' + candidateLabel + (pickingTime ? '時間' : '日期'));

  useEffect(() => {
    if (step === 0 && !heading.current?.dataset.visited) return;
    heading.current?.focus({ preventScroll: true });
  }, [step, candidate, pickingTime]);

  function changeStep(next: number) {
    if (heading.current) heading.current.dataset.visited = 'true';
    setMessage('');
    setStep(next);
  }

  function openCandidate(index: number) {
    setCandidate(index);
    setPickingTime(false);
    setMessage('');
    setStep(1);
  }

  function confirmTime() {
    if (!candidateValues[candidate] || !(Date.parse(candidateValues[candidate] + '+08:00') > Date.now())) {
      setMessage('請選擇未來的開始時間。');
      return;
    }
    if (candidateValues[0] === candidateValues[1]) {
      setMessage('請分開選擇兩組不同的未來日期與時間。');
      return;
    }
    setConfirmed(previous => previous.map((value, index) => index === candidate || value));
    if (candidate === 0) openCandidate(1);
    else changeStep(2);
  }

  function goBack() {
    setMessage('');
    if (step === 2) {
      if (format === 'written') changeStep(1);
      else {
        setCandidate(1);
        setPickingTime(true);
        setStep(1);
      }
    } else if (pickingTime && format === 'live') {
      setPickingTime(false);
    } else if (candidate === 1 && format === 'live') {
      setCandidate(0);
      setPickingTime(true);
    } else changeStep(0);
  }

  function updateSlot(candidateIndex: number, field: 'date' | 'time', value: string) {
    if (slots[candidateIndex][field] !== value) {
      setConfirmed(previous => previous.map((saved, index) => index !== candidateIndex && saved));
    }
    setSlots((previous) => previous.map((slot, index) => index === candidateIndex ? { ...slot, [field]: value } : slot));
  }

  useEffect(() => {
    function receiveCartError(event: MessageEvent) {
      if (event.origin === 'https://furmosa.com' && event.source === window.parent &&
        event.data?.type === 'cynthia-booking-cart-error') {
        setMessage('暫時無法加入購物袋，請再試一次。');
      }
    }
    window.addEventListener('message', receiveCartError);
    return () => window.removeEventListener('message', receiveCartError);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    if (step === 3 && window.parent === window) return;
    event.preventDefault();
    if (pending || step !== 2) return;
    const form = new FormData(event.currentTarget);
    form.set('category', services[categoryIndex].label);
    form.set('format', format);
    if (format === 'live') {
      form.set('first', slots[0].date && slots[0].time ? `${slots[0].date}T${slots[0].time}` : '');
      form.set('second', slots[1].date && slots[1].time ? `${slots[1].date}T${slots[1].time}` : '');
    } else {
      form.set('delivery', delivery);
    }
    setPending(true);
    setMessage('');
    try {
      const result = await submitBooking(form);
      if (result.variantId) {
        setCheckout(result);
        changeStep(3);
      } else setMessage(result.message ?? '暫時無法送出，請稍後重試。');
    } catch {
      setMessage('暫時無法送出，請稍後重試。');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3" data-booking-step={step}>
      <div className="flex items-center justify-between gap-2">
        <h2 ref={heading} tabIndex={-1} className="text-lg font-bold outline-none">{title}</h2>
        {step > 0 && step < 3 && <button type="button" disabled={pending} onClick={goBack} className="min-h-11 shrink-0 text-sm underline">返回上一步</button>}
      </div>
      <div className="grid gap-1.5">
        <p className="text-sm font-semibold" aria-live="polite">
          第 {currentProgress + 1} 步／共 {progressLabels.length} 步 · {currentProgressLabel}
        </p>
        <ol aria-label="預約進度" className="flex gap-1.5 text-center text-xs leading-tight">
          {progressLabels.map((label, index) => (
            <li key={label} aria-current={index === currentProgress ? 'step' : undefined}
              className={`grid min-w-0 flex-1 gap-1 ${index === currentProgress ? 'font-bold' : 'text-[#515469]'}`}>
              <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-[#e9e7e3]">
                <span className={styles.fill} data-state={index < currentProgress ? 'complete' : index === currentProgress ? 'current' : 'upcoming'} />
              </span>
              <span>
                {index < currentProgress && <><span aria-hidden="true">✓ </span><span className="sr-only">已完成：</span></>}
                {label}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {format === 'live' && step > 0 && <span role="status" aria-label={`已記下 ${completed} 組，共 2 組`} className="sr-only" />}
      {step === 0 && <>
        <fieldset className="grid gap-2">
          <legend className="mb-2 font-semibold">服務類別</legend>
          {services.map(({ label }, index) => (
            <label key={label} className="flex min-h-11 items-center gap-2 rounded-lg border border-[#ded9cf] px-3 has-[:checked]:bg-[#fff4ca]">
              <input type="radio" name="category" checked={categoryIndex === index} onChange={() => setCategoryIndex(index)} />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-2 font-semibold">服務方式</legend>
          {(['live', 'written'] as const).map(method => (
            <label key={method} className="flex min-h-11 items-center gap-2 rounded-lg border border-[#ded9cf] px-3 has-[:checked]:bg-[#fff4ca]">
              <input type="radio" name="format" checked={format === method} onChange={() => setFormat(method)} />
              {method === 'live' ? '即時線上' : '非即時圖文'}
            </label>
          ))}
        </fieldset>
        <p className="flex justify-between border-t border-[#ded9cf] pt-3 font-bold"><span>服務費用</span><span>NT${services[categoryIndex][format].toLocaleString('zh-TW')}</span></p>
      </>}
      {step === 1 && <>
        {format === 'live' && candidate === 0 && choosingDate && (
          <p className="text-sm">選兩組方便的時段，匠寵會優先確認首選。</p>
        )}
        {format === 'live' && candidate === 1 && confirmed[0] && (
          <button type="button" className={`min-h-11 rounded-lg bg-[#fff4ca] px-3 text-left text-sm ${styles.savedSlot}`} onClick={() => openCandidate(0)}>
            <strong>✓ 首選已記下</strong> {slots[0].date} {slots[0].time} <span className="underline">修改</span>
          </button>
        )}
        {format === 'live' && candidate === 1 && choosingDate && (
          <p className="text-sm">首選排不開時，匠寵會再跟你確認備用時段。</p>
        )}
        {choosingDate ? (
          <div className={format === 'live' && candidate === 1 ? 'min-w-0 rounded-lg border border-[#f1cd54]' : ''}>
            {format === 'live' && candidate === 1 && <p className="bg-[#ffe071] py-1 text-center text-sm font-bold">備用日期 · 已記下 {completed} / 2 組</p>}
            <BookingCalendar key={format + candidate} today={today} initialDate={format === 'live' && candidate === 1 ? slots[0].date : undefined} selected={format === 'live' ? slot.date : delivery}
            onSelect={(date) => {
              if (format === 'written') {
                setDelivery(date);
                changeStep(2);
              } else {
                updateSlot(candidate, 'date', date);
                setMessage('');
                setPickingTime(true);
              }
            }} />
          </div>
        ) : (
          <>
            <p className="text-sm">已選日期 {slot.date}</p>
            <label>開始時間（台灣時間）
              <select className={inputClass} value={slot.time} onChange={(event) => updateSlot(candidate, 'time', event.target.value)}>
                <option value="">選擇時間</option>
                {halfHourTimes.map(time => (
                  <option key={time} value={time} disabled={Date.parse(slot.date + 'T' + time + '+08:00') <= Date.now()}>{time}</option>
                ))}
              </select>
            </label>
          </>
        )}
      </>}
      {step === 2 && <>
        <section className="rounded-xl border border-[#ded9cf] p-3 text-sm">
          <h3 className="font-bold">預約內容</h3>
          <p>{services[categoryIndex].label}／{format === 'live' ? '即時線上' : '非即時圖文'}</p>
          {format === 'live' ? slots.map(({ date, time }, index) => (
            <button key={index} type="button" disabled={pending} onClick={() => openCandidate(index)} className="flex min-h-11 w-full items-center justify-between gap-2 text-left">
              <span><strong>{index === 0 ? '首選' : '備用'}</strong> {date} {time}</span><span className="underline">修改</span>
            </button>
          )) : <p>期望交付日 {delivery}</p>}
        </section>
        <label>聯絡人姓名<input className={inputClass} name="name" autoComplete="name" maxLength={80} required
          value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>LINE ID<input className={inputClass} name="lineId" autoCapitalize="none" autoCorrect="off"
          maxLength={64} pattern={String.raw`[a-zA-Z0-9._\-]+`} required value={lineId} aria-describedby="booking-line-help"
          onChange={(event) => setLineId(event.target.value)} /></label>
        <p id="booking-line-help" className="text-sm">請填寫可搜尋的 LINE ID，並開啟「允許利用 ID 加入好友」。</p>
        <input name="website" hidden tabIndex={-1} autoComplete="off" />
        <p className="text-sm">如需改期，請至少於原訂時段前 14 天透過 LINE 聯繫匠寵。</p>
      </>}
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      {step === 3 && checkout && (
        <section className="grid gap-4">
          <p className="rounded-xl border border-[#ded9cf] bg-[#fff9e7] p-4 font-semibold">
            {services[categoryIndex].label}／{format === 'live' ? '即時線上' : '非即時圖文'} · NT${services[categoryIndex][format].toLocaleString('zh-TW')}
          </p>
          <p role="status">已收到預約申請，待付款。完成付款後，匠寵會透過 LINE 與你確認預約。</p>
          <p className="text-sm">預約編號 {checkout.reference}</p>
          <button
            type="submit"
            formAction="https://furmosa.com/cart/add"
            formMethod="post"
            onClick={(event) => {
              if (window.parent === window) return;
              event.preventDefault();
              window.parent.postMessage({
                type: 'cynthia-booking-add-to-cart',
                variantId: checkout.variantId,
                properties: checkout.cartProperties,
              }, 'https://furmosa.com');
            }}
            className="rounded-lg bg-[#ffe071] px-4 py-3 text-center font-semibold"
          >加入購物袋</button>
          <input type="hidden" name="id" value={checkout.variantId} />
          <input type="hidden" name="quantity" value="1" />
          <input type="hidden" name="return_to" value="/cart" />
          {Object.entries(checkout.cartProperties).map(([key, value]) => (
            <input key={key} type="hidden" name={'properties[' + key + ']'} value={value} />
          ))}
        </section>
      )}
      {step < 3 && !choosingDate && <div className="grid gap-2">
        {step === 2 ? (
          <button type="submit" disabled={pending} className="rounded-lg bg-[#ffe071] px-4 py-3 font-semibold disabled:opacity-60">
            {pending ? '送出中…' : '確認預約資料'}
          </button>
        ) : (
          <button type="button" className="rounded-lg bg-[#ffe071] px-4 py-3 font-semibold" onClick={() => step === 0 ? changeStep(1) : confirmTime()}>
            {step === 0 ? '選擇時段' : candidate === 0 ? '記下首選' : '記下備用'}
          </button>
        )}
        {step === 2 && <p className="text-center text-sm">請先完成付款，匠寵再透過 LINE 與你確認預約。</p>}
      </div>}
    </form>
  );
}
