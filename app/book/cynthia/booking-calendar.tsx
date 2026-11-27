'use client';

import { useState } from 'react';

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
const pad = (value: number) => String(value).padStart(2, '0');
const dateKey = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

export function BookingCalendar({ today, selected, onSelect }: {
  today: string;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const [month, setMonth] = useState((selected || today).slice(0, 7));
  const [year, monthNumber] = month.split('-').map(Number);
  const monthIndex = monthNumber - 1;
  const offset = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  function changeMonth(delta: number) {
    const next = new Date(Date.UTC(year, monthIndex + delta, 1));
    setMonth(dateKey(next.getUTCFullYear(), next.getUTCMonth(), 1).slice(0, 7));
  }

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="size-11 rounded-lg border border-[#ded9cf] disabled:opacity-30" onClick={() => changeMonth(-1)} disabled={month <= today.slice(0, 7)} aria-label="上個月">‹</button>
        <p className="font-semibold" aria-live="polite">{year} 年 {monthNumber} 月</p>
        <button type="button" className="size-11 rounded-lg border border-[#ded9cf]" onClick={() => changeMonth(1)} aria-label="下個月">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((day) => <span key={day} className="py-2 text-sm text-muted-foreground">{day}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1;
          const date = dateKey(year, monthIndex, day);
          const active = selected === date;
          return (
            <button key={date} type="button" aria-label={date} aria-pressed={active} disabled={date < today}
              onClick={() => onSelect(date)}
              className={`min-h-11 rounded-lg text-sm disabled:opacity-25 ${active ? 'bg-[#ffe071] font-semibold' : 'hover:bg-muted'}`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
