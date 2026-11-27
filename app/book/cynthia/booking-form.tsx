'use client';

import { useRef, useState, type FormEvent } from 'react';
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
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [lineId, setLineId] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const candidateValues = slots.map(({ date, time }) => date && time ? date + 'T' + time : '');
  const stepLabels = ['選擇服務', '選擇時段', '填寫 LINE'];

  function changeStep(next: number) {
    if (next === 2 && step === 1) {
      if (format === 'live' && (candidateValues.some((value) => !value || !(Date.parse(value + '+08:00') > Date.now())) || candidateValues[0] === candidateValues[1])) {
        setMessage('請分開選擇兩組不同的未來日期與時間。');
        return;
      }
      if (format === 'written' && !delivery) {
        setMessage('請選擇期望交付日。');
        return;
      }
    }
    setMessage('');
    setStep(next);
    heading.current?.focus();
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
    <form onSubmit={submit} className="grid gap-4">
      <section aria-label="預約流程">
        <h2 className="sr-only">預約流程</h2>
        <ol className="grid grid-cols-3 gap-2 text-center text-sm">
          {stepLabels.map((label, index) => (
            <li key={label} aria-current={step === index ? 'step' : undefined}
              className={`rounded-full px-2 py-2 ${step === index ? 'bg-[#ffe071] font-bold' : 'bg-[#f6f4f0]'}`}>
              {index + 1}. {label}
            </li>
          ))}
        </ol>
      </section>
      <h2 ref={heading} tabIndex={-1} className="sr-only">{stepLabels[step]}</h2>
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
      {step === 1 && (format === 'live' ? <fieldset className="grid min-w-0 gap-3">
        <legend className="mb-2 font-semibold">選擇兩組候選時段</legend>
        {slots.map((slot, index) => (
          <section key={index} className="grid gap-3 rounded-xl border border-[#ded9cf] p-3">
            <button type="button" aria-expanded={candidate === index} aria-controls={`candidate-${index}`}
              className="min-h-11 text-left font-semibold" onClick={() => setCandidate(index)}>
              {index === 0 ? '第一候選時段' : '第二候選時段'}
              {slot.date && <span className="block text-sm font-normal">{slot.date} {slot.time}</span>}
            </button>
            <div id={`candidate-${index}`} hidden={candidate !== index}>
              {candidate === index && <div className="grid gap-3">
                <BookingCalendar today={today} selected={slot.date} onSelect={(date) => updateSlot(index, 'date', date)} />
                <label>開始時間（台灣時間）
                  <input className={inputClass} type="time" value={slot.time}
                    onChange={(event) => updateSlot(index, 'time', event.target.value)} />
                </label>
                {index === 0 && candidateValues[0] && (
                  <button type="button" className="rounded-lg bg-[#ffe071] p-3 font-semibold" onClick={() => setCandidate(1)}>
                    確認第一組，選擇第二組
                  </button>
                )}
              </div>}
            </div>
          </section>
        ))}
        <p className="text-sm">請填你方便的時間，實際預約時段由匠寵確認。</p>
      </fieldset> : <fieldset className="grid min-w-0 gap-3">
        <legend className="mb-2 font-semibold">期望收到圖文的日期</legend>
        <BookingCalendar today={today} selected={delivery} onSelect={setDelivery} />
        {delivery && <p className="text-sm">期望交付日：{delivery}</p>}
      </fieldset>)}
      {step === 2 && <>
        <label>聯絡人姓名<input className={inputClass} name="name" autoComplete="name" maxLength={80} required
          value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>LINE ID<input className={inputClass} name="lineId" autoCapitalize="none" autoCorrect="off"
          maxLength={64} pattern={String.raw`[a-zA-Z0-9._\-]+`} required value={lineId} aria-describedby="booking-line-help"
          onChange={(event) => setLineId(event.target.value)} /></label>
        <p id="booking-line-help" className="text-sm">請填寫可搜尋的 LINE ID，並開啟「允許利用 ID 加入好友」。</p>
        <section className="rounded-xl border border-[#ded9cf] p-4">
          <h3 className="font-bold">預約內容</h3>
          <p>{services[categoryIndex].label}／{format === 'live' ? '即時線上' : '非即時圖文'}</p>
          {format === 'live' ? slots.map(({ date, time }, index) => (
            <p key={index}>{index === 0 ? '第一候選時段' : '第二候選時段'} {date} {time}</p>
          )) : <p>期望交付日 {delivery}</p>}
        </section>
        <input name="website" hidden tabIndex={-1} autoComplete="off" />
        <p className="text-sm">如需改期，請至少於原訂時段前 14 天透過 LINE 聯繫匠寵。</p>
      </>}
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <div className="sticky bottom-0 grid gap-2 border-t border-[#ded9cf] bg-white py-3">
        {step === 2 ? (
          <button type="submit" disabled={pending} className="rounded-lg bg-[#ffe071] px-4 py-3 font-semibold disabled:opacity-60">
            {pending ? '送出中…' : '送出預約申請'}
          </button>
        ) : (
          <button type="button" className="rounded-lg bg-[#ffe071] px-4 py-3 font-semibold" onClick={() => changeStep(step + 1)}>
            下一步
          </button>
        )}
        {step > 0 && <button type="button" disabled={pending} onClick={() => changeStep(step - 1)} className="min-h-11 underline">返回上一步</button>}
        {step === 2 && <p className="text-center text-sm">匠寵會透過 LINE 確認，確認後再付款。</p>}
      </div>
    </form>
  );
}
