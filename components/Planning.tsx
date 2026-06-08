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

const START_HOUR = 7;
const END_HOUR = 20;
const HOUR_HEIGHT = 76;
const GOOGLE_BLOIS_EMBED_URL = 'https://calendar.google.com/calendar/embed?src=blois%40vroommarket.fr&ctz=Europe%2FParis&mode=WEEK';

const timeSlots = Array.from({ length: 53 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 15;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

type PlanningEvent = {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  agency_id: number | null;
  color: string | null;
};

type CurrentAgentForPlanning = {
  id: number;
  full_name: string;
  agency_id: number | null;
  account_type: string | null;
};

function getPlanningAgencyName(agencyId: number | null) {
  if (Number(agencyId) === 1) return 'Blois';
  if (Number(agencyId) === 2) return 'Tours';
  if (Number(agencyId) === 3) return 'Bourges';
  return 'Agence';
}

function getPlanningAgencyIcon(agencyId: number | null) {
  if (Number(agencyId) === 1) return '🟢';
  if (Number(agencyId) === 2) return '🔵';
  if (Number(agencyId) === 3) return '🟠';
  return '🔴';
}

function GoogleBloisCalendar() {
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h4>🟢 Agenda Google VM BLOIS</h4>
          <p className="muted">Affichage en lecture seule de l’agenda Google existant : blois@vroommarket.fr.</p>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid rgba(148, 163, 184, 0.25)',
          background: 'rgba(15, 23, 42, 0.35)'
        }}
      >
        <iframe
          title="Agenda Google VM BLOIS"
          src={GOOGLE_BLOIS_EMBED_URL}
          style={{
            border: 0,
            width: '100%',
            height: 720,
            display: 'block',
            background: '#ffffff'
          }}
        />
      </div>
    </div>
  );
}

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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDatePart(value: string) {
  return value.slice(0, 10);
}

function getTimePart(value: string) {
  return value.slice(11, 16);
}

function getLocalDate(value: string) {
  const datePart = getDatePart(value);
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getDayIndex(date: string, weekStart: Date) {
  const d = getLocalDate(date);
  const cleanStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  return Math.floor((d.getTime() - cleanStart.getTime()) / 86400000);
}

function getEventClass(event: PlanningEvent) {
  if (event.agency_id === 1) return 'blois';
  if (event.agency_id === 2) return 'tours';
  if (event.agency_id === 3) return 'bourges';
  return 'perso';
}

function agencyColor(agencyId: number | null) {
  if (agencyId === 1) return 'green';
  if (agencyId === 2) return 'blue';
  if (agencyId === 3) return 'orange';
  return 'red';
}

function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getDurationMinutes(event: PlanningEvent) {
  const start = timeToMinutes(getTimePart(event.start_date));
  const end = timeToMinutes(getTimePart(event.end_date));
  return Math.max(15, end - start);
}

function getEventTop(event: PlanningEvent) {
  const start = timeToMinutes(getTimePart(event.start_date));
  const calendarStart = START_HOUR * 60;
  return Math.max(0, Math.round(((start - calendarStart) / 60) * HOUR_HEIGHT));
}

function getEventHeight(event: PlanningEvent) {
  const minutes = getDurationMinutes(event);
  return Math.max(44, Math.round((minutes / 60) * HOUR_HEIGHT));
}

export default function Planning({
  currentAgent = null,
  isResponsable = true,
}: {
  currentAgent?: CurrentAgentForPlanning | null;
  isResponsable?: boolean;
} = {}) {
  const today = new Date();
  const responsableMode = isResponsable === true;
  const agentAgencyId = currentAgent?.agency_id ?? null;
  const agentAgencyName = getPlanningAgencyName(agentAgencyId);

  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(formatDateForInput(today));

  const [events, setEvents] = useState<PlanningEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PlanningEvent | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(formatDateForInput(today));
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formAgencyId, setFormAgencyId] = useState<number | null>(responsableMode ? 1 : agentAgencyId);

  const weekStart = useMemo(() => getMonday(new Date(selectedDate)), [selectedDate]);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const weekDays = useMemo(() => dayNames.map((_, i) => addDays(weekStart, i)), [weekStart]);
  const weekNumber = getWeekNumber(weekStart);

  const visibleEvents = useMemo(() => {
    if (responsableMode) return events;

    if (!agentAgencyId) return [];

    return events.filter((event) => Number(event.agency_id) === Number(agentAgencyId));
  }, [events, responsableMode, agentAgencyId]);

  async function loadEvents() {
    setLoading(true);

    const start = `${formatDateForInput(weekStart)} 00:00:00`;
    const end = `${formatDateForInput(weekEnd)} 00:00:00`;

    const { data, error } = await supabase
      .from('planning_events')
      .select('*')
      .gte('start_date', start)
      .lt('start_date', end)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('Erreur planning:', error);
      setEvents([]);
    } else {
      setEvents(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (responsableMode) {
      loadEvents();
    } else {
      setLoading(false);
    }
  }, [weekStart, weekEnd, responsableMode]);

  function resetForm() {
    setEditingEvent(null);
    setFormTitle('');
    setFormDescription('');
    setFormDate(selectedDate);
    setFormStartTime('09:00');
    setFormEndTime('10:00');
    setFormAgencyId(responsableMode ? 1 : agentAgencyId);
  }

  function openNewEventForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditEventForm(event: PlanningEvent) {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormDescription(event.description || '');
    setFormDate(getDatePart(event.start_date));
    setFormStartTime(getTimePart(event.start_date));
    setFormEndTime(getTimePart(event.end_date));
    setFormAgencyId(event.agency_id);
    setShowForm(true);
  }

  function previousWeek() {
    const newDateValue = addDays(new Date(selectedDate), -7);
    setSelectedDate(formatDateForInput(newDateValue));
    setSelectedYear(newDateValue.getFullYear());
    setSelectedMonth(newDateValue.getMonth());
  }

  function nextWeek() {
    const newDateValue = addDays(new Date(selectedDate), 7);
    setSelectedDate(formatDateForInput(newDateValue));
    setSelectedYear(newDateValue.getFullYear());
    setSelectedMonth(newDateValue.getMonth());
  }

  function goToday() {
    const newDateValue = new Date();
    setSelectedDate(formatDateForInput(newDateValue));
    setSelectedYear(newDateValue.getFullYear());
    setSelectedMonth(newDateValue.getMonth());
  }

  function changeMonth(month: number) {
    setSelectedMonth(month);
    const newDateValue = new Date(selectedYear, month, 1);
    setSelectedDate(formatDateForInput(newDateValue));
  }

  function changeYear(year: number) {
    setSelectedYear(year);
    const newDateValue = new Date(year, selectedMonth, 1);
    setSelectedDate(formatDateForInput(newDateValue));
  }

  async function saveEvent() {
    if (!formTitle.trim()) {
      alert('Il faut mettre un titre au rendez-vous.');
      return;
    }

    if (formEndTime <= formStartTime) {
      alert("L'heure de fin doit être après l'heure de début.");
      return;
    }

    setSaving(true);

    const startDate = `${formDate} ${formStartTime}:00`;
    const endDate = `${formDate} ${formEndTime}:00`;

    const payload = {
      title: formTitle,
      description: formDescription || null,
      start_date: startDate,
      end_date: endDate,
      agency_id: responsableMode ? formAgencyId : agentAgencyId,
      color: agencyColor(responsableMode ? formAgencyId : agentAgencyId),
    };

    const { error } = editingEvent
      ? await supabase.from('planning_events').update(payload).eq('id', editingEvent.id)
      : await supabase.from('planning_events').insert(payload);

    if (error) {
      console.error('Erreur sauvegarde événement:', error);
      alert("Erreur pendant l'enregistrement du rendez-vous.");
    } else {
      setShowForm(false);
      setEditingEvent(null);
      setSelectedDate(formDate);

      const d = new Date(formDate);
      setSelectedYear(d.getFullYear());
      setSelectedMonth(d.getMonth());

      await loadEvents();
    }

    setSaving(false);
  }

  async function deleteEvent() {
    if (!editingEvent) return;

    const ok = confirm(`Supprimer le rendez-vous "${editingEvent.title}" ?`);
    if (!ok) return;

    setSaving(true);

    const { error } = await supabase
      .from('planning_events')
      .delete()
      .eq('id', editingEvent.id);

    if (error) {
      console.error('Erreur suppression événement:', error);
      alert('Erreur pendant la suppression du rendez-vous.');
    } else {
      setShowForm(false);
      setEditingEvent(null);
      await loadEvents();
    }

    setSaving(false);
  }

  if (!responsableMode) {
    return (
      <div className="card">
        <h3>📅 Planning</h3>

        {Number(agentAgencyId) === 1 ? (
          <GoogleBloisCalendar />
        ) : (
          <div className="card" style={{ marginTop: 12 }}>
            <h4>{getPlanningAgencyIcon(agentAgencyId)} Agenda Google {agentAgencyName}</h4>
            <p className="muted">
              L’agenda Google de cette agence n’est pas encore configuré. Pour le moment, seul l’agenda Google VM BLOIS est intégré.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h3>📅 Planning Benoît + agendas agences</h3>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <button onClick={previousWeek}>⬅️ Semaine précédente</button>
            <button onClick={goToday}>📍 Aujourd'hui</button>
            <button onClick={nextWeek}>Semaine suivante ➡️</button>
            <button onClick={openNewEventForm}>➕ Nouveau rendez-vous</button>
          </div>

          <p className="muted">
            Vue Responsable : ton planning personnel et les agendas des agences.
          </p>

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
            onChange={(e) => {
              const d = new Date(e.target.value);
              setSelectedDate(e.target.value);
              setSelectedYear(d.getFullYear());
              setSelectedMonth(d.getMonth());
            }}
          />
        </div>
      </div>

      <div className="grid cards3" style={{ marginTop: 12 }}>
        <div className="item">
          <strong>🔴 Planning Benoît</strong>
          <p className="muted">Tes rendez-vous personnels et Direction.</p>
        </div>

        <div className="item">
          <strong>🟢 Agenda Google Blois</strong>
          <p className="muted">Agenda Google VM BLOIS intégré en lecture seule.</p>
        </div>

        <div className="item">
          <strong>🔵 Agenda Tours</strong>
          <p className="muted">À configurer quand l’agenda Google Tours existera.</p>
        </div>

        <div className="item">
          <strong>🟠 Agenda Bourges</strong>
          <p className="muted">À configurer quand l’agenda Google Bourges existera.</p>
        </div>
      </div>

      <GoogleBloisCalendar />

      {showForm && (
        <div className="card" style={{ marginTop: 12, marginBottom: 12 }}>
          <h4>{editingEvent ? '✏️ Modifier le rendez-vous' : '➕ Ajouter un rendez-vous'}</h4>

          <div style={{ display: 'grid', gap: 10 }}>
            <input
              placeholder="Titre du rendez-vous"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
            />

            <textarea
              placeholder="Description"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
            />

            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
            />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)}>
                {timeSlots.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>

              <select value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)}>
                {timeSlots.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>

              <select
                value={formAgencyId ?? ''}
                onChange={(e) => setFormAgencyId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="1">Blois</option>
                <option value="2">Tours</option>
                <option value="3">Bourges</option>
                <option value="">Personnel / Direction</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={saveEvent} disabled={saving}>
                {saving ? 'Enregistrement...' : editingEvent ? '💾 Modifier' : '✅ Enregistrer'}
              </button>

              {editingEvent && (
                <button onClick={deleteEvent} disabled={saving}>
                  🗑 Supprimer
                </button>
              )}

              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingEvent(null);
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <p className="muted">Chargement du planning...</p>}

      {!loading && visibleEvents.length === 0 && (
        <p className="muted">Aucun événement enregistré sur cette semaine.</p>
      )}

      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <div
          style={{
            minWidth: 950,
            display: 'grid',
            gridTemplateColumns: '70px repeat(7, 1fr)',
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: 16,
            overflow: 'hidden',
            background: 'rgba(15, 23, 42, 0.35)'
          }}
        >
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

          <div style={{ position: 'relative' }}>
            {hours.map((h) => (
              <div
                key={h}
                className="calcell hour"
                style={{
                  height: HOUR_HEIGHT,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  paddingTop: 8
                }}
              >
                {h}
              </div>
            ))}
          </div>

          {weekDays.map((date, dayIndex) => {
            const dayEvents = visibleEvents.filter((event) => getDayIndex(event.start_date, weekStart) === dayIndex);

            return (
              <div
                key={date.toISOString()}
                style={{
                  position: 'relative',
                  minHeight: (END_HOUR - START_HOUR) * HOUR_HEIGHT,
                  borderLeft: '1px solid rgba(148, 163, 184, 0.18)'
                }}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    style={{
                      height: HOUR_HEIGHT,
                      borderBottom: '1px solid rgba(148, 163, 184, 0.14)'
                    }}
                  />
                ))}

                {dayEvents.map((event) => (
                  <div
                    className={`event ${getEventClass(event)}`}
                    key={event.id}
                    onClick={() => openEditEventForm(event)}
                    style={{
                      position: 'absolute',
                      top: getEventTop(event) + 4,
                      left: 6,
                      right: 6,
                      minHeight: getEventHeight(event) - 8,
                      height: getEventHeight(event) - 8,
                      cursor: 'pointer',
                      overflow: 'hidden',
                      zIndex: 2
                    }}
                    title="Cliquer pour modifier ou supprimer"
                  >
                    <strong>{event.title}</strong>
                    <div style={{ fontSize: 11, opacity: 0.85 }}>
                      {getTimePart(event.start_date)} - {getTimePart(event.end_date)}
                    </div>
                    {event.description && getEventHeight(event) > 65 && (
                      <div style={{ fontSize: 12, opacity: 0.9 }}>
                        {event.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
