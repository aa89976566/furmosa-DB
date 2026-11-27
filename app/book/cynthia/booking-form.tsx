'use client';

import { useState, type FormEvent } from 'react';
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
  const [slots, setSlots] = useState([{ date: '', time: '' }, { date: '', time: '' }]);
  const [delivery, setDelivery] = useState('');
  const activeSlot = slots[candidate];

  function updateSlot(field: 'date' | 'time', value: string) {
    setSlots((previous) => previous.map((slot, index) => index === candidate ? { ...slot, [field]: value } : slot));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
      if (result) setMessage(result.message);
    } catch {
      setMessage('暫時無法送出，請稍後重試。');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label>服務類別
        <select name="category" className={inputClass} onChange={(event) => setCategoryIndex(event.currentTarget.selectedIndex)}>
          {services.map(({ label }) => <option key={label}>{label}</option>)}
        </select>
      </label>
      <label>服務方式
        <select name="format" className={inputClass} value={format} onChange={(event) => setFormat(event.target.value === 'live' ? 'live' : 'written')}>
          <option value="live">即時線上</option><option value="written">非即時圖文</option>
        </select>
      </label>
      <p className="border-b border-[#ded9cf] pb-4 text-2xl font-bold">NT${services[categoryIndex][format].toLocaleString('zh-TW')}</p>
      {format === 'live' ? <fieldset className="grid min-w-0 gap-3">
        <legend className="mb-2 font-semibold">選擇兩組候選時段</legend>
        <div className="grid grid-cols-2 gap-2">
          {slots.map((slot, index) => (
            <button key={index} type="button" aria-pressed={candidate === index} onClick={() => setCandidate(index)}
              className={`min-h-11 rounded-lg border border-[#ded9cf] p-2 text-sm font-semibold ${candidate === index ? 'bg-[#ffe071]' : ''}`}>
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
          <button type="button" className="rounded-lg bg-[#ffe071] p-3 font-semibold" onClick={() => setCandidate(1)}>
            選擇第二候選時段
          </button>
        )}
        <p className="text-sm text-muted-foreground">請填你方便的時間，實際預約時段由匠寵確認。</p>
      </fieldset> : <fieldset className="grid min-w-0 gap-3">
        <legend className="mb-2 font-semibold">期望收到圖文的日期</legend>
        <BookingCalendar today={today} selected={delivery} onSelect={setDelivery} />
        {delivery && <p className="text-sm">期望交付日：{delivery}</p>}
      </fieldset>}
      <label>聯絡人姓名<input className={inputClass} name="name" autoComplete="name" maxLength={80} required /></label>
      <label>電子郵件<input className={inputClass} name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <input name="website" hidden tabIndex={-1} autoComplete="off" />
      <p className="text-sm">確認預約後，如需改期或取消，請至少於約定時間前一週通知匠寵客服。</p>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <button type="submit" disabled={pending} className="rounded-lg bg-[#ffe071] px-4 py-3 font-semibold disabled:opacity-60">
        {pending ? '送出中…' : '送出預約申請'}
      </button>
      <p className="text-center text-sm text-muted-foreground">時段或交付日確認後再付款。</p>
    </form>
  );
}
