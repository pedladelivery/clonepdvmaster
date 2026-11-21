import React from 'react';
import { Input } from './input';
import { Label } from './label';
import { Switch } from './switch';

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DayHours {
  enabled: boolean;
  open: string;
  close: string;
}

export type WeeklyHours = Record<DayKey, DayHours>;

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Segunda-feira' },
  { key: 'tue', label: 'Terça-feira' },
  { key: 'wed', label: 'Quarta-feira' },
  { key: 'thu', label: 'Quinta-feira' },
  { key: 'fri', label: 'Sexta-feira' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

export const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  mon: { enabled: true, open: '08:00', close: '18:00' },
  tue: { enabled: true, open: '08:00', close: '18:00' },
  wed: { enabled: true, open: '08:00', close: '18:00' },
  thu: { enabled: true, open: '08:00', close: '18:00' },
  fri: { enabled: true, open: '08:00', close: '18:00' },
  sat: { enabled: true, open: '08:00', close: '13:00' },
  sun: { enabled: false, open: '08:00', close: '13:00' },
};

export function parseWeeklyHours(raw: string | null | undefined): WeeklyHours {
  if (!raw) return { ...DEFAULT_WEEKLY_HOURS };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'mon' in parsed) {
      return { ...DEFAULT_WEEKLY_HOURS, ...parsed };
    }
  } catch {
    // legacy plain text — ignore and use default
  }
  return { ...DEFAULT_WEEKLY_HOURS };
}

export function serializeWeeklyHours(hours: WeeklyHours): string {
  return JSON.stringify(hours);
}

export function formatWeeklyHoursText(hours: WeeklyHours): string {
  return DAYS.map(({ key, label }) => {
    const d = hours[key];
    return d.enabled ? `${label}: ${d.open} às ${d.close}` : `${label}: Fechado`;
  }).join(' | ');
}

interface Props {
  value: WeeklyHours;
  onChange: (value: WeeklyHours) => void;
}

export const WeeklyHoursEditor: React.FC<Props> = ({ value, onChange }) => {
  const update = (key: DayKey, patch: Partial<DayHours>) => {
    onChange({ ...value, [key]: { ...value[key], ...patch } });
  };

  return (
    <div className="space-y-3">
      <Label>Horário de Funcionamento</Label>
      <div className="space-y-2 rounded-md border p-3">
        {DAYS.map(({ key, label }) => {
          const day = value[key];
          return (
            <div
              key={key}
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] items-center gap-2"
            >
              <div className="flex items-center gap-2">
                <Switch
                  checked={day.enabled}
                  onCheckedChange={(checked) => update(key, { enabled: checked })}
                />
                <span className="text-sm font-medium">{label}</span>
              </div>
              <Input
                type="time"
                value={day.open}
                disabled={!day.enabled}
                onChange={(e) => update(key, { open: e.target.value })}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground text-center">às</span>
              <Input
                type="time"
                value={day.close}
                disabled={!day.enabled}
                onChange={(e) => update(key, { close: e.target.value })}
                className="w-28"
              />
              {!day.enabled && (
                <span className="text-xs text-muted-foreground sm:col-span-3">Fechado</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
