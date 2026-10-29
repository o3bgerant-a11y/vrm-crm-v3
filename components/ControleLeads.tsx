'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Lead = {
  event_id: string;
  start_at: string;
  title: string;
  agent_code: string | null;
  outcome: 'signed' | 'unsigned' | 'no_show' | 'cancelled' | 'review' | 'scheduled';
  errors: string[];
  event_url: string | null;
};
type Sync = { checked_at: string; source_event_count: number; lead_event_count: number };
const agents = [['ML', 'Maveryk'], ['LJ', 'Loïck'], ['AR', 'Axel'], ['EF', 'Evan'], ['CP', 'Charles']] as const;
const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const labels: Record<Lead['outcome'], string> = { signed: 'Signé', unsigned: 'Non signé', no_show: 'No show', cancelled: 'Annulé', review: 'À clarifier', scheduled: 'À venir' };
const dateTime = (value: string) => new Date(value).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' });
const isBillable = (lead: Lead) => lead.outcome === 'signed' || lead.outcome === 'unsigned';

function monthBoundary(year: number, monthIndex: number) {
  const date = new Date(Date.UTC(year, monthIndex, 1));
  const zone = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'shortOffset' })
    .formatToParts(date).find(part => part.type === 'timeZoneName')?.value || 'GMT+1';
  const offsetHours = Number(zone.replace('GMT', ''));
  return new Date(date.getTime() - offsetHours * 3600000).toISOString();
}

export default function ControleLeads() {
  const today = new Date();
  const parisParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: 'numeric' }).formatToParts(today);
  const currentYear = Number(parisParts.find(p => p.type === 'year')?.value);
  const currentMonth = Number(parisParts.find(p => p.type === 'month')?.value);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sync, setSync] = useState<Sync | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      setLeads([]);
      setSync(null);
      try {
        const start = monthBoundary(year, month - 1);
        const end = monthBoundary(year, month);
        const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
        const [firstPage, syncResult] = await Promise.all([
          supabase.from('lead_control_events').select('event_id,start_at,title,agent_code,outcome,errors,event_url')
            .eq('agency_id', 1).gte('start_at', start).lt('start_at', end).order('start_at').order('event_id').range(0, 499),
          supabase.from('lead_control_syncs').select('checked_at,source_event_count,lead_event_count')
            .eq('agency_id', 1).eq('month_start', monthStart).maybeSingle(),
        ]);
        if (firstPage.error) throw firstPage.error;
        if (syncResult.error) throw syncResult.error;
        const rows = (firstPage.data || []) as Lead[];
        for (let offset = 500; rows.length === offset; offset += 500) {
          const page = await supabase.from('lead_control_events').select('event_id,start_at,title,agent_code,outcome,errors,event_url')
            .eq('agency_id', 1).gte('start_at', start).lt('start_at', end).order('start_at').order('event_id').range(offset, offset + 499);
          if (page.error) throw page.error;
          rows.push(...(page.data || []) as Lead[]);
        }
        if (!cancelled) { setLeads(rows); setSync(syncResult.data); }
      } catch {
        if (!cancelled) setError('Impossible de charger le contrôle des leads. Vérifie ta connexion et tes droits Responsable, puis réessaie.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [year, month, refresh]);

  const stats = useMemo(() => {
    const count = (outcome: Lead['outcome']) => leads.filter(l => l.outcome === outcome).length;
    return { billable: leads.filter(isBillable).length, signed: count('signed'), unsigned: count('unsigned'), noShow: count('no_show'), cancelled: count('cancelled'), review: count('review'), scheduled: count('scheduled') };
  }, [leads]);
  const issues = leads.filter(l => l.errors.length > 0);
  const unassigned = leads.filter(l => isBillable(l) && !l.agent_code).length;
  const years = Array.from({ length: Math.max(1, currentYear - 2026 + 1) }, (_, i) => 2026 + i);

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ClipboardCheck size={20} aria-hidden="true" /> Contrôle mensuel des leads</h3>
            <p className="muted">Blois · Historique depuis septembre 2026 · Mise à jour quotidienne à 19 h, heure de Paris.</p>
          </div>
          <button className="btn" onClick={() => setRefresh(v => v + 1)} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={16} aria-hidden="true" /> Relire les données
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 18 }}>
          <label style={{ display: 'grid', gap: 6 }}>Agence<select value="blois" onChange={() => {}}><option value="blois">Blois</option></select></label>
          <label style={{ display: 'grid', gap: 6 }}>Année<select value={year} onChange={e => { const y = Number(e.target.value); setYear(y); if (y === 2026 && month < 9) setMonth(9); }}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 6 }}>Mois<select value={month} onChange={e => setMonth(Number(e.target.value))}>{months.map((name, i) => <option key={name} value={i + 1} disabled={year === 2026 && i < 8}>{name}</option>)}</select></label>
        </div>
        {sync && <p className="muted" style={{ marginTop: 14 }}>Dernière synchronisation : {dateTime(sync.checked_at)}. Les rendez-vous non terminés à cette heure sont exclus des totaux.</p>}
      </div>

      {loading ? <div className="card" role="status">Chargement du récapitulatif…</div> : error ? <div className="card" role="alert" style={{ borderColor: '#ef4444' }}>{error}</div> : !sync ? (
        <div className="card"><h3>Aucune synchronisation pour ce mois</h3><p className="muted">Les données de ce mois n’ont pas encore été importées. Aucun total n’est présenté comme vérifié.</p></div>
      ) : (
        <>
          <div className="grid cards3">
            {[
              ['Leads facturables', stats.billable], ['Coût total HT', (stats.billable * 99).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })],
              ['Leads signés', stats.signed], ['Leads non signés', stats.unsigned], ['No show · non facturés', stats.noShow], ['Annulés · non facturés', stats.cancelled],
            ].map(([label, value]) => <div className="card" key={label}><h3>{label}</h3><div className="stat-value">{value}</div></div>)}
          </div>
          <div className="card">
            <p className="muted">99 € HT par lead signé ou non signé. Rendez-vous bleus, dimanches et activités internes exclus. {stats.review > 0 ? `${stats.review} lead(s) sans résultat certain restent hors du total facturable, à régulariser.` : ''} {stats.scheduled > 0 ? `${stats.scheduled} rendez-vous à venir / non terminés.` : ''}</p>
          </div>
          <div className="card">
            <h3>Répartition par agent — {months[month - 1]} {year}</h3>
            <div style={{ overflowX: 'auto' }}><table className="table"><thead><tr><th>Agent</th><th>Leads facturables attribués</th><th>Signés</th><th>Non signés</th><th>À clarifier</th></tr></thead><tbody>
              {agents.map(([code, name]) => { const rows = leads.filter(l => l.agent_code === code); return <tr key={code}><td><strong>{name}</strong> <span className="muted">({code})</span></td><td><strong>{rows.filter(isBillable).length}</strong></td><td>{rows.filter(l => l.outcome === 'signed').length}</td><td>{rows.filter(l => l.outcome === 'unsigned').length}</td><td>{rows.filter(l => l.outcome === 'review').length}</td></tr>; })}
              {unassigned > 0 && <tr><td><strong>Non attribués — à corriger</strong></td><td>{unassigned}</td><td>{leads.filter(l => !l.agent_code && l.outcome === 'signed').length}</td><td>{leads.filter(l => !l.agent_code && l.outcome === 'unsigned').length}</td><td>—</td></tr>}
            </tbody></table></div>
          </div>
          <div className="card" style={{ borderColor: issues.length ? '#ef4444' : undefined }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={20} aria-hidden="true" /> Leads en erreur ({issues.length})</h3>
            {issues.length === 0 ? <p className="muted">Aucune erreur détectée dans les leads synchronisés.</p> : <div style={{ overflowX: 'auto' }}><table className="table"><thead><tr><th>Date et heure</th><th>Rendez-vous</th><th>Agent</th><th>Détail à corriger</th><th>Agenda</th></tr></thead><tbody>
              {issues.map(l => <tr key={l.event_id}><td style={{ whiteSpace: 'nowrap' }}>{dateTime(l.start_at)}</td><td>{l.title}</td><td>{l.agent_code || 'Non identifié'}</td><td>{l.errors.join(' · ')}</td><td>{l.event_url && <a href={l.event_url} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir le rendez-vous du ${dateTime(l.start_at)}`}><ExternalLink size={18} /></a>}</td></tr>)}
            </tbody></table></div>}
          </div>
          <div className="card">
            <details><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Détail des rendez-vous ({leads.length})</summary><div style={{ overflowX: 'auto', marginTop: 12 }}><table className="table"><thead><tr><th>Date et heure</th><th>Rendez-vous</th><th>Agent</th><th>Résultat</th></tr></thead><tbody>{leads.map(l => <tr key={l.event_id}><td style={{ whiteSpace: 'nowrap' }}>{dateTime(l.start_at)}</td><td>{l.title}</td><td>{l.agent_code || '—'}</td><td>{labels[l.outcome]}</td></tr>)}</tbody></table></div></details>
          </div>
        </>
      )}
    </>
  );
}
