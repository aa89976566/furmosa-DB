import type { MerchantSettings } from '@prisma/client';

export type BookingSchedule = {
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  capacityPerSlot: number;
  weekdays: number[];
};

export function parseHhMm(value: string): { hours: number; minutes: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

export function parseWeekdays(raw: string): number[] {
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

export function scheduleFromSettings(settings: MerchantSettings): BookingSchedule {
  const weekdays = parseWeekdays(settings.bookingWeekdays);
  return {
    openTime: settings.bookingOpenTime || '09:00',
    closeTime: settings.bookingCloseTime || '18:00',
    slotMinutes: Math.max(15, settings.bookingSlotMinutes || 60),
    capacityPerSlot: Math.max(1, settings.bookingCapacityPerSlot || 1),
    weekdays: weekdays.length > 0 ? weekdays : [1, 2, 3, 4, 5, 6],
  };
}

/** Local calendar date YYYY-MM-DD → Date at local midnight (server TZ). */
export function parseLocalDate(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null;
  }
  return dt;
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function formatLocalTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export type SlotCandidate = {
  startsAt: Date;
  endsAt: Date;
  occupied: number;
  capacity: number;
  isFull: boolean;
};

/**
 * Build slots for one local calendar day from shared merchant schedule.
 * Does not optimise — only enumerates open→close by slotMinutes.
 */
export function buildDaySlots(
  day: Date,
  schedule: BookingSchedule,
  occupancyByStartMs: Map<number, number>,
): SlotCandidate[] {
  if (!schedule.weekdays.includes(day.getDay())) return [];

  const open = parseHhMm(schedule.openTime);
  const close = parseHhMm(schedule.closeTime);
  if (!open || !close) return [];

  const openMin = open.hours * 60 + open.minutes;
  const closeMin = close.hours * 60 + close.minutes;
  if (closeMin <= openMin) return [];

  const slots: SlotCandidate[] = [];
  for (let t = openMin; t + schedule.slotMinutes <= closeMin; t += schedule.slotMinutes) {
    const startsAt = new Date(day);
    startsAt.setHours(Math.floor(t / 60), t % 60, 0, 0);
    const endsAt = new Date(startsAt.getTime() + schedule.slotMinutes * 60_000);
    const occupied = occupancyByStartMs.get(startsAt.getTime()) ?? 0;
    const capacity = schedule.capacityPerSlot;
    slots.push({
      startsAt,
      endsAt,
      occupied,
      capacity,
      isFull: occupied >= capacity,
    });
  }
  return slots;
}
