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
  const [delivery, setDelivery] = useState('');
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [lineId, setLineId] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const candidateValues = slots.map(({ date, time }) => date && time ? date + 'T' + time : '');
  const slot = slots[candidate];
  const choosingDate = step === 1 && (format === 'written' || !pickingTime);
  const candidateLabel = candidate === 0 ? '第一候選' : '第二候選';
  const title = step === 0 ? '選擇服務' : step === 2 ? '填寫 LINE' :
    format === 'written' ? '選擇期望交付日' : candidateLabel + (pickingTime ? '時間' : '日期');

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
      if (result) setMessage(result.message);
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
        {step > 0 && <button type="button" disabled={pending} onClick={goBack} className="min-h-11 shrink-0 text-sm underline">返回上一步</button>}
      </div>
      {step === 0 && <>
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
      <p className="border-b border-[#ded9cf] pb-4 text-2xl font-bold">NT${services[categoryIndex][format].toLocaleString('zh-TW')}</p>
      </>}
      {step === 1 && <>
        {format === 'live' && candidate === 1 && candidateValues[0] && (
          <button type="button" className="min-h-11 rounded-lg border border-[#ded9cf] px-3 text-left text-sm" onClick={() => openCandidate(0)}>
            第一候選時段 {slots[0].date} {slots[0].time} <span className="underline">修改</span>
          </button>
        )}
        {choosingDate ? (
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
        <label>聯絡人姓名<input className={inputClass} name="name" autoComplete="name" maxLength={80} required
          value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>LINE ID<input className={inputClass} name="lineId" autoCapitalize="none" autoCorrect="off"
          maxLength={64} pattern={String.raw`[a-zA-Z0-9._\-]+`} required value={lineId} aria-describedby="booking-line-help"
          onChange={(event) => setLineId(event.target.value)} /></label>
        <p id="booking-line-help" className="text-sm">請填寫可搜尋的 LINE ID，並開啟「允許利用 ID 加入好友」。</p>
        <section className="rounded-xl border border-[#ded9cf] p-3 text-sm">
          <h3 className="font-bold">預約內容</h3>
          <p>{services[categoryIndex].label}／{format === 'live' ? '即時線上' : '非即時圖文'}</p>
          {format === 'live' ? slots.map(({ date, time }, index) => (
            <button key={index} type="button" disabled={pending} onClick={() => openCandidate(index)} className="block min-h-11 text-left underline">
              {index === 0 ? '第一候選時段' : '第二候選時段'} {date} {time}
            </button>
          )) : <p>期望交付日 {delivery}</p>}
        </section>
        <input name="website" hidden tabIndex={-1} autoComplete="off" />
        <p className="text-sm">如需改期，請至少於原訂時段前 14 天透過 LINE 聯繫匠寵。</p>
      </>}
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      {!choosingDate && <div className="grid gap-2">
        {step === 2 ? (
          <button type="submit" disabled={pending} className="rounded-lg bg-[#ffe071] px-4 py-3 font-semibold disabled:opacity-60">
            {pending ? '送出中…' : '送出預約申請'}
          </button>
        ) : (
          <button type="button" className="rounded-lg bg-[#ffe071] px-4 py-3 font-semibold" onClick={() => step === 0 ? changeStep(1) : confirmTime()}>
            {step === 0 ? '下一步' : candidate === 0 ? '確認第一組，選擇第二組' : '確認第二組'}
          </button>
        )}
        {step === 2 && <p className="text-center text-sm">匠寵會透過 LINE 確認，確認後再付款。</p>}
      </div>}
    </form>
  );
}
