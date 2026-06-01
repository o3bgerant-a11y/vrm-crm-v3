'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const hours = ['8h', '9h', '10h', '11h', '12h', '14h', '15h', '16h', '17h'];

type PlanningEvent = {
  id: number;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  agency_id: number | null;
  color: string | null;
};

function getDayIndex(date: string) {
  const day = new Date(date).getDay();
  return day === 0 ? 6 : day - 1;
}

function getHourLabel(date: string) {
  return `${new Date(date).getHours()}h`;
}

function getEventClass(event: PlanningEvent) {
  if (event.agency_id === 1) return 'blois';
  if (event.agency_id === 2) return 'tours';
  if (event.agency_id === 3) return 'bourges';
  return 'perso';
}

export default function Planning() {
  const [events, setEvents] = useState<PlanningEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEvents() {
      const { data, error } = await supabase
        .from('planning_events')
        .select('*')
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Erreur planning:', error);
      } else {
        setEvents(data || []);
      }

      setLoading(false);
    }

    loadEvents();
  }, []);

  return (
    <div className="card">
      <h3>📅 Planning Benoît</h3>

      <p className="muted">
        Vue semaine - Blois, Tours, Bourges et personnel
      </p>

      {loading && <p className="muted">Chargement du planning...</p>}

      {!loading && events.length === 0 && (
        <p className="muted">Aucun événement enregistré pour le moment.</p>
      )}

      <div className="calendar">
        <div className="calcell calhead">Heure</div>

        {days.map((d) => (
          <div className="calcell calhead" key={d}>
            {d}
          </div>
        ))}

        {hours.map((h) => (
          <>
            <div className="calcell hour" key={h}>
              {h}
            </div>

            {days.map((d, i) => (
              <div className="calcell" key={h + d}>
                {events
                  .filter(
                    (event) =>
                      getHourLabel(event.start_date) === h &&
                      getDayIndex(event.start_date) === i
                  )
                  .map((event) => (
                    <div
                      className={`event ${getEventClass(event)}`}
                      key={event.id}
                    >
                      {event.title}
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
