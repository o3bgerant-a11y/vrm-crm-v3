'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const hours = [
  '7h', '8h', '9h', '10h', '11h', '12h',
  '13h', '14h', '15h', '16h', '17h', '18h', '19h'
];

type PlanningEvent = {
  id: number;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  agency_id: number | null;
  color: string | null;
};

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function formatDateForInput(date: Date) {
  return date.toISOString().split('T')[0];
}

function getHourLabel(date: string) {
  const d = new Date(date);
  return `${d.getHours()}h`;
}

function getDayIndex(date: string, weekStart: Date) {
  const d = new Date(date);
  const cleanDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const cleanStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  return Math.floor((cleanDate.getTime() - cleanStart.getTime()) / 86400000);
}

function getEventClass(event: PlanningEvent) {
  if (event.agency_id === 1) return 'blois';
  if (event.agency_id === 2) return 'tours';
  if (event.agency_id === 3) return 'bourges';
  return 'perso';
}

export default function Planning() {
  const today = new Date();

  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(formatDateForInput(today));
  const [events, setEvents] = useState<PlanningEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStart = useMemo(() => getMonday(new Date(selectedDate)), [selectedDate]);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const weekDays = useMemo(() => dayNames.map((_, i) => addDays(weekStart, i)), [weekStart]);
  const weekNumber = getWeekNumber(weekStart);

  useEffect(() => {
    async function loadEvents() {
      setLoading(true);

      const { data, error } = await supabase
        .from('planning_events')
        .select('*')
        .gte('start_date', weekStart.toISOString())
        .lt('start_date', weekEnd.toISOString())
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Erreur planning:', error);
        setEvents([]);
      } else {
        setEvents(data || []);
      }

      setLoading(false);
    }

    loadEvents();
  }, [weekStart, weekEnd]);

  function changeMonth(month: number) {
    setSelectedMonth(month);
    const newDate = new Date(selectedYear, month, 1);
    setSelectedDate(formatDateForInput(newDate));
  }

  function changeYear(year: number) {
    setSelectedYear(year);
    const newDate = new Date(year, selectedMonth, 1);
    setSelectedDate(formatDateForInput(newDate));
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h3>📅 Planning Benoît</h3>
          <p className="muted">
            Semaine {weekNumber} — du {weekStart.toLocaleDateString('fr-FR')} au {addDays(weekStart, 6).toLocaleDateString('fr-FR')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={selectedYear} onChange={(e) => changeYear(Number(e.target.value))}>
            {[2025, 2026, 2027, 2028].map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <select value={selectedMonth} onChange={(e) => changeMonth(Number(e.target.value))}>
            {monthNames.map((month, index) => (
              <option key={month} value={index}>{month}</option>
            ))}
          </select>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {loading && <p className="muted">Chargement du planning...</p>}

      {!loading && events.length === 0 && (
        <p className="muted">Aucun événement enregistré sur cette semaine.</p>
      )}

      <div className="calendar">
        <div className="calcell calhead">Heure</div>

        {weekDays.map((date, i) => (
          <div className="calcell calhead" key={date.toISOString()}>
            <div>{dayNames[i]}</div>
            <strong>{date.getDate()}</strong>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {monthNames[date.getMonth()].slice(0, 3)}
            </div>
          </div>
        ))}

        {hours.map((h) => (
          <>
            <div className="calcell hour" key={h}>{h}</div>

            {weekDays.map((date, i) => (
              <div className="calcell" key={`${h}-${i}`}>
                {events
                  .filter((event) =>
                    getHourLabel(event.start_date) === h &&
                    getDayIndex(event.start_date, weekStart) === i
                  )
                  .map((event) => (
                    <div className={`event ${getEventClass(event)}`} key={event.id}>
                      <strong>{event.title}</strong>
                      {event.description && (
                        <div style={{ fontSize: 12, opacity: 0.9 }}>
                          {event.description}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ))}
          </>
        ))}
      </div>
    </div>
  );
}
