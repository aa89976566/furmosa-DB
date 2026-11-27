'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { submitBooking } from './actions';
import { BookingCalendar } from './booking-calendar';

const inputClass = 'mt-1 min-h-11 w-full rounded-lg border border-[#ded9cf] bg-white px-3 py-2 text-base';
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
  const [checkout, setCheckout] = useState<{ checkoutUrl: string; reference: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const candidateValues = slots.map(({ date, time }) => date && time ? date + 'T' + time : '');
  const slot = slots[candidate];
  const choosingDate = step === 1 && (format === 'written' || !pickingTime);
  const progressLabels = format === 'live' ? ['首選', '備用', '聯絡', '付款'] : ['交付日期', '聯絡', '付款'];
  const currentProgress = step === 0 ? -1 : step === 1 ? (format === 'live' ? candidate : 0) : step + progressLabels.length - 4;
  const completed = confirmed.filter(Boolean).length;
  const candidateLabel = candidate === 0 ? '首選' : '備用';
  const title = step === 3 ? '完成付款' : step === 0 ? '選擇服務' : step === 2 ? (format === 'live' ? '兩組時段已選好' : '填寫 LINE') :
    format === 'written' ? '選擇期望交付日' : (candidate === 1 && !pickingTime ? '再選一個備用日期' : '選' + candidateLabel + (pickingTime ? '時間' : '日期'));

  useEffect(() => {
    if (step === 0 && !heading.current?.dataset.visited) return;
    heading.current?.focus();
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

  async function submit(event: FormEvent<HTMLFormElement>) {
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
      if (result.checkoutUrl) {
        setCheckout({ checkoutUrl: result.checkoutUrl, reference: result.reference });
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
      <ol aria-label="預約進度" className="flex text-center text-xs font-semibold">
        {progressLabels.map((label, index) => (
          <li key={label} aria-current={index === currentProgress ? 'step' : undefined} className="relative flex flex-1 flex-col items-center gap-1">
            {index > 0 && <span aria-hidden className="absolute right-1/2 top-3 h-px w-full bg-[#b4b6be]" />}
            <span aria-hidden className={`relative grid size-6 place-items-center rounded-full border border-[#a8aab3] ${index <= currentProgress ? 'bg-[#ffe071]' : 'bg-white'}`}>
              {index < currentProgress ? '✓' : ''}
            </span>
            {label}
          </li>
        ))}
      </ol>
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
          <button type="button" className="min-h-11 rounded-lg bg-[#fff4ca] px-3 text-left text-sm" onClick={() => openCandidate(0)}>
            <strong>✓ 首選已記下</strong> {slots[0].date} {slots[0].time} <span className="underline">修改</span>
          </button>
        )}
        {format === 'live' && candidate === 1 && choosingDate && (
          <p className="text-sm">首選排不開時，匠寵會再跟你確認備用時段。</p>
        )}
        {choosingDate ? (
          <div className={format === 'live' && candidate === 1 ? 'overflow-hidden rounded-lg border border-[#f1cd54]' : ''}>
            {format === 'live' && candidate === 1 && <p className="bg-[#ffe071] py-1 text-center text-sm font-bold">備用日期 · 已記下 1 / 2 組</p>}
            <BookingCalendar key={format + candidate} today={today} selected={format === 'live' ? slot.date : delivery}
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
              <input className={inputClass} type="time" value={slot.time}
                onChange={(event) => updateSlot(candidate, 'time', event.target.value)} />
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
          <a href={checkout.checkoutUrl} target="_top" onClick={(event) => {
            if (window.parent === window) return;
            event.preventDefault();
            window.parent.postMessage({ type: 'cynthia-booking-checkout', checkoutUrl: checkout.checkoutUrl }, 'https://furmosa.com');
          }} className="rounded-lg bg-[#ffe071] px-4 py-3 text-center font-semibold">前往 Shopify 結帳</a>
        </section>
      )}
      {step < 3 && !choosingDate && <div className="grid gap-2">
        {step === 2 ? (
          <button type="submit" disabled={pending} className="rounded-lg bg-[#ffe071] px-4 py-3 font-semibold disabled:opacity-60">
            {pending ? '送出中…' : '前往付款'}
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
