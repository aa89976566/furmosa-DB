'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { submitBooking } from './actions';
import { BookingCalendar } from './booking-calendar';

const inputClass = 'w-full rounded-lg border bg-background px-3 py-2';
const primaryButton = 'rounded-lg bg-[#FFE16A] px-4 py-3 font-semibold text-black disabled:opacity-60';
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
  const [slots, setSlots] = useState([{ date: '', time: '' }, { date: '', time: '' }]);
  const [delivery, setDelivery] = useState('');
  const activeSlot = slots[candidate];
  const [reviewing, setReviewing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const method = format === 'live' ? '即時線上' : '非即時圖文';
  const candidates = slots.map(({ date, time }) => date && time ? date + 'T' + time : '');

  useEffect(() => {
    if (reviewing) heading.current?.focus();
  }, [reviewing]);

  function review() {
    if (format === 'live' && (candidates.some((slot) => !slot || Date.parse(slot + '+08:00') <= Date.now()) || candidates[0] === candidates[1])) {
      setMessage('請選擇兩組不同的未來日期與時間。');
      return;
    }
    if (format === 'written' && !delivery) {
      setMessage('請選擇期望交付日。');
      return;
    }
    setMessage('');
    setReviewing(true);
  }

  function updateSlot(field: 'date' | 'time', value: string) {
    setSlots((previous) => previous.map((slot, index) => index === candidate ? { ...slot, [field]: value } : slot));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewing || pending) return;
    const form = new FormData(event.currentTarget);
    form.set('category', services[categoryIndex].label);
    form.set('format', format);
    if (format === 'live') {
      form.set('first', candidates[0]);
      form.set('second', candidates[1]);
    } else {
      form.set('delivery', delivery);
    }
    setPending(true);
    setMessage('');
    try {
      const result = await submitBooking(form);
      if (result) setMessage(result.message);
    } catch {
      setMessage('暫時無法送出，請稍後重試。');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">
        {reviewing ? '確認預約申請' : '選擇服務與日期'}
      </h2>
      {!reviewing ? <>
      <label>服務類別
        <select name="category" value={services[categoryIndex].label} className={inputClass} onChange={(event) => setCategoryIndex(event.currentTarget.selectedIndex)}>
          {services.map(({ label }) => <option key={label}>{label}</option>)}
        </select>
      </label>
      <label>服務方式
        <select name="format" className={inputClass} value={format} onChange={(event) => setFormat(event.target.value === 'live' ? 'live' : 'written')}>
          <option value="live">即時線上</option><option value="written">非即時圖文</option>
        </select>
      </label>
      <p className="font-semibold">NT$ {services[categoryIndex][format].toLocaleString('zh-TW')}</p>
      {format === 'live' ? <fieldset className="grid min-w-0 gap-3">
        <legend className="mb-2 font-semibold">選擇兩組候選時段</legend>
        <div className="grid grid-cols-2 gap-2">
          {slots.map((slot, index) => (
            <button key={index} type="button" aria-pressed={candidate === index} onClick={() => setCandidate(index)}
              className={`rounded-lg border p-2 text-sm ${candidate === index ? 'bg-[#FFE16A] text-black' : ''}`}>
              {index === 0 ? '第一候選時段' : '第二候選時段'}
              {slot.date && <span className="block">{slot.date} {slot.time}</span>}
            </button>
          ))}
        </div>
        <BookingCalendar key={candidate} today={today} selected={activeSlot.date} onSelect={(date) => updateSlot('date', date)} />
        <label>開始時間（台灣時間）
          <input className={inputClass} type="time" value={activeSlot.time} onChange={(event) => updateSlot('time', event.target.value)} />
        </label>
        {candidate === 0 && activeSlot.date && activeSlot.time && (
          <button type="button" className="rounded-lg bg-[#FFE16A] p-3 font-semibold text-black" onClick={() => setCandidate(1)}>
            選擇第二候選時段
          </button>
        )}
        <p className="text-sm text-muted-foreground">請填你方便的時間，實際預約時段由匠寵確認。</p>
      </fieldset> : <fieldset className="grid min-w-0 gap-3">
        <legend className="mb-2 font-semibold">期望收到圖文的日期</legend>
        <BookingCalendar today={today} selected={delivery} onSelect={setDelivery} />
        {delivery && <p className="text-sm">期望交付日：{delivery}</p>}
      </fieldset>}
      </> : <>
        <dl className="grid gap-3 rounded-lg border p-3 text-sm">
          <div><dt className="text-muted-foreground">服務</dt><dd>{services[categoryIndex].label}／{method}</dd></div>
          {format === 'live' ? slots.map(({ date, time }, index) => (
            <div key={index}><dt className="text-muted-foreground">{index === 0 ? '第一候選' : '第二候選'}（台灣時間）</dt><dd>{date} {time}</dd></div>
          )) : <div><dt className="text-muted-foreground">期望交付日</dt><dd>{delivery}</dd></div>}
        </dl>
        <label>聯絡人姓名<input className={inputClass} name="name" autoComplete="name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label>電子郵件<input className={inputClass} name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <input name="website" hidden tabIndex={-1} autoComplete="off" />
      </>}
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      {reviewing ? <>
        <button type="submit" disabled={pending} className={primaryButton}>{pending ? '送出中…' : '送出預約申請'}</button>
        <button type="button" disabled={pending} className="min-h-11 underline" onClick={() => { setMessage(''); setReviewing(false); }}>返回修改日期</button>
      </> : <button type="button" className={primaryButton} onClick={review}>下一步</button>}
    </form>
  );
}
