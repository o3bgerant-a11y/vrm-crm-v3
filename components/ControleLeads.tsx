'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardCheck, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Lead = {
  calendar_id: string;
  event_id: string;
  start_at: string;
  title: string;
  agent_code: string | null;
  outcome: 'signed' | 'unsigned' | 'no_show' | 'cancelled' | 'review' | 'scheduled';
  errors: string[];
  event_url: string | null;
  corrected_at: string | null;
  corrected_by_name: string | null;
};
type Sync = { checked_at: string; source_event_count: number; lead_event_count: number };
const agencies = [
  { id: 1, name: 'Blois', calendar: 'blois@vroommarket.fr' },
  { id: 2, name: 'Tours', calendar: 'tours@vroommarket.fr' },
] as const;
const agencyAgents: Record<number, ReadonlyArray<readonly [string, string]>> = {
  1: [['ML', 'Maveryk'], ['LJ', 'Loïck'], ['AR', 'Axel'], ['EF', 'Evan'], ['CP', 'Charles']],
  2: [['CP', 'Charles'], ['MLG', 'Maël'], ['FB', 'Florent']],
};
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
  const [agencyId, setAgencyId] = useState(1);
  const agency = agencies.find(item => item.id === agencyId) || agencies[0];
  const agents = agencyAgents[agency.id];
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sync, setSync] = useState<Sync | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [draftAgent, setDraftAgent] = useState('');
  const [draftOutcome, setDraftOutcome] = useState<Lead['outcome']>('review');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (editing) return;
    if (previousFocus.current?.isConnected) previousFocus.current.focus();
    else if (previousFocus.current) document.getElementById('lead-control-refresh')?.focus();
    previousFocus.current = null;
  }, [editing]);

  function editLead(lead: Lead) {
    previousFocus.current = document.activeElement as HTMLElement | null;
    setEditing(lead);
    setDraftAgent(lead.agent_code || '');
    setDraftOutcome(lead.outcome === 'scheduled' ? 'review' : lead.outcome);
    setSaveError('');
    setNotice('');
  }

  async function saveCorrection() {
    if (!editing || saving) return;
    if ((draftOutcome === 'signed' || draftOutcome === 'unsigned') && !draftAgent) {
      setSaveError('Choisis un agent pour un lead signé ou non signé.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('save_agency_lead_control_correction', {
        p_calendar_id: editing.calendar_id,
        p_event_id: editing.event_id,
        p_agent_code: draftAgent || null,
        p_outcome: draftOutcome,
        p_expected_corrected_at: editing.corrected_at || null,
      });
      if (rpcError) throw rpcError;
      if (!data || data.event_id !== editing.event_id || data.calendar_id !== editing.calendar_id) throw new Error('Réponse de sauvegarde invalide.');
      setLeads(current => current.map(lead => lead.event_id === data.event_id && lead.calendar_id === data.calendar_id ? data as Lead : lead));
      setEditing(null);
      setNotice('Correction enregistrée. Les totaux sont recalculés et la correction sera conservée lors des prochaines synchronisations.');
    } catch (cause: unknown) {
      const code = (cause as { code?: string })?.code;
      setSaveError(code === '40001' || code === 'P0002'
        ? 'Ce lead a changé depuis son chargement. Ferme cette fenêtre, clique sur « Relire les données », puis réessaie.'
        : code === '42501'
          ? 'Ta session ou tes droits Responsable ne permettent pas cette correction. Reconnecte-toi et réessaie.'
          : 'La correction n’a pas pu être enregistrée. Tes données restent inchangées ; réessaie.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      setLeads([]);
      setSync(null);
      setNotice('');
      try {
        const start = monthBoundary(year, month - 1);
        const end = monthBoundary(year, month);
        const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
        const [firstPage, syncResult] = await Promise.all([
          supabase.from('lead_control_events').select('calendar_id,event_id,start_at,title,agent_code,outcome,errors,event_url,corrected_at,corrected_by_name')
            .eq('agency_id', agencyId).gte('start_at', start).lt('start_at', end).order('start_at').order('event_id').range(0, 499),
          supabase.from('lead_control_syncs').select('checked_at,source_event_count,lead_event_count')
            .eq('agency_id', agencyId).eq('month_start', monthStart).maybeSingle(),
        ]);
        if (firstPage.error) throw firstPage.error;
        if (syncResult.error) throw syncResult.error;
        const rows = (firstPage.data || []) as Lead[];
        for (let offset = 500; rows.length === offset; offset += 500) {
          const page = await supabase.from('lead_control_events').select('calendar_id,event_id,start_at,title,agent_code,outcome,errors,event_url,corrected_at,corrected_by_name')
            .eq('agency_id', agencyId).gte('start_at', start).lt('start_at', end).order('start_at').order('event_id').range(offset, offset + 499);
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
  }, [agencyId, year, month, refresh]);

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
            <p className="muted">{agency.name} · Historique depuis septembre 2026 · Mise à jour quotidienne à 19 h, heure de Paris.</p>
          </div>
          <button id="lead-control-refresh" className="btn" onClick={() => setRefresh(v => v + 1)} disabled={loading || !!editing} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw size={16} aria-hidden="true" /> Relire les données
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 18 }}>
          <label style={{ display: 'grid', gap: 6 }}>Agence<select value={agencyId} disabled={!!editing} onChange={event => { const id = Number(event.target.value); if (id === 1 || id === 2) setAgencyId(id); }}>{agencies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 6 }}>Année<select value={year} disabled={!!editing} onChange={e => { const y = Number(e.target.value); setYear(y); if (y === 2026 && month < 9) setMonth(9); }}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
          <label style={{ display: 'grid', gap: 6 }}>Mois<select value={month} disabled={!!editing} onChange={e => setMonth(Number(e.target.value))}>{months.map((name, i) => <option key={name} value={i + 1} disabled={year === 2026 && i < 8}>{name}</option>)}</select></label>
        </div>
        {sync && <p className="muted" style={{ marginTop: 14 }}>Dernière synchronisation : {dateTime(sync.checked_at)}. Les rendez-vous non terminés sont exclus des totaux, sauf résultat confirmé manuellement.</p>}
        <p className="muted" style={{ marginTop: 8 }}>Tu peux corriger un lead à tout moment, même après 19 h, depuis la liste des erreurs ou le détail des rendez-vous. Les corrections du CRM sont conservées sans modifier l’agenda Google.</p>
      </div>

      {notice && <div className="card" role="status" style={{ borderColor: '#22c55e' }}>{notice}</div>}

      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <section className="card" role="dialog" aria-modal="true" aria-labelledby="lead-correction-title" onKeyDown={event => {
            if (event.key === 'Escape' && !saving) { event.preventDefault(); setEditing(null); }
            if (event.key !== 'Tab') return;
            const controls = event.currentTarget.querySelectorAll<HTMLElement>('select:not(:disabled), button:not(:disabled)');
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }} style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', margin: 0 }}>
            <h3 id="lead-correction-title">Modifier le lead</h3>
            <p style={{ marginTop: 12 }}><strong>{dateTime(editing.start_at)}</strong> — {editing.title}</p>
            <form onSubmit={event => { event.preventDefault(); saveCorrection(); }} style={{ display: 'grid', gap: 16, marginTop: 18 }}>
              <label style={{ display: 'grid', gap: 6 }}>Agent concerné
                <select autoFocus value={draftAgent} disabled={saving} onChange={event => setDraftAgent(event.target.value)}>
                  <option value="">Non attribué</option>
                  {agents.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>Statut du lead
                <select value={draftOutcome} disabled={saving} onChange={event => setDraftOutcome(event.target.value as Lead['outcome'])}>
                  <option value="signed">Signé — facturable</option>
                  <option value="unsigned">Non signé — facturable</option>
                  <option value="cancelled">Annulé — non facturé</option>
                  <option value="no_show">No show — non facturé</option>
                  <option value="review">À clarifier — résultat à renseigner</option>
                </select>
              </label>
              <p className="muted">La correction met à jour les totaux et reste prioritaire sur les prochains contrôles de 19 h. Le mail déjà envoyé reste inchangé.</p>
              {saveError && <p role="alert" style={{ color: '#f87171' }}>{saveError}</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" disabled={saving} onClick={() => setEditing(null)}>Fermer</button>
                <button className="btn" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer la correction'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

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
            <p className="muted">99 € HT par lead signé ou non signé. {agencyId === 1 ? 'Rendez-vous bleus, dimanches et activités internes exclus.' : 'Dimanches et activités internes identifiées exclus. Les mandats dont l’origine ou le résultat est incertain restent à contrôler.'} {stats.review > 0 ? `${stats.review} lead(s) sans résultat certain restent hors du total facturable, à régulariser.` : ''} {stats.scheduled > 0 ? `${stats.scheduled} rendez-vous à venir / non terminés.` : ''}</p>
          </div>
          <div className="card">
            <h3>Répartition par agent — {agency.name} — {months[month - 1]} {year}</h3>
            <div style={{ overflowX: 'auto' }}><table className="table"><thead><tr><th>Agent</th><th>Leads facturables attribués</th><th>Signés</th><th>Non signés</th><th>À clarifier</th></tr></thead><tbody>
              {agents.map(([code, name]) => { const rows = leads.filter(l => l.agent_code === code); return <tr key={code}><td><strong>{name}</strong> <span className="muted">({code})</span></td><td><strong>{rows.filter(isBillable).length}</strong></td><td>{rows.filter(l => l.outcome === 'signed').length}</td><td>{rows.filter(l => l.outcome === 'unsigned').length}</td><td>{rows.filter(l => l.outcome === 'review').length}</td></tr>; })}
              {unassigned > 0 && <tr><td><strong>Non attribués — à corriger</strong></td><td>{unassigned}</td><td>{leads.filter(l => !l.agent_code && l.outcome === 'signed').length}</td><td>{leads.filter(l => !l.agent_code && l.outcome === 'unsigned').length}</td><td>—</td></tr>}
            </tbody></table></div>
          </div>
          <div className="card" style={{ borderColor: issues.length ? '#ef4444' : undefined }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={20} aria-hidden="true" /> Leads en erreur ({issues.length})</h3>
            {issues.length === 0 ? <p className="muted">Aucune erreur détectée dans les leads synchronisés.</p> : <div style={{ overflowX: 'auto' }}><table className="table"><thead><tr><th>Date et heure</th><th>Rendez-vous</th><th>Agent</th><th>Détail à corriger</th><th>Agenda</th><th>Correction</th></tr></thead><tbody>
              {issues.map(l => <tr key={l.event_id}><td style={{ whiteSpace: 'nowrap' }}>{dateTime(l.start_at)}</td><td>{l.title}</td><td>{l.agent_code || 'Non identifié'}</td><td>{l.errors.join(' · ')}</td><td>{l.event_url && <a href={l.event_url} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir le rendez-vous du ${dateTime(l.start_at)}`}><ExternalLink size={18} /></a>}</td><td><button type="button" onClick={() => editLead(l)} aria-label={`Modifier le lead du ${dateTime(l.start_at)}`}>Modifier</button></td></tr>)}
            </tbody></table></div>}
          </div>
          <div className="card">
            <details><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Détail des rendez-vous ({leads.length})</summary><div style={{ overflowX: 'auto', marginTop: 12 }}><table className="table"><thead><tr><th>Date et heure</th><th>Rendez-vous</th><th>Agent</th><th>Résultat</th><th>Correction</th></tr></thead><tbody>{leads.map(l => <tr key={l.event_id}><td style={{ whiteSpace: 'nowrap' }}>{dateTime(l.start_at)}</td><td>{l.title}</td><td>{l.agent_code || '—'}</td><td>{labels[l.outcome]}{l.corrected_at && <p className="muted" style={{ marginTop: 4 }}>Corrigé le {dateTime(l.corrected_at)} par {l.corrected_by_name || 'un responsable'}</p>}</td><td><button type="button" onClick={() => editLead(l)} aria-label={`Modifier le lead du ${dateTime(l.start_at)}`}>Modifier</button></td></tr>)}</tbody></table></div></details>
          </div>
        </>
      )}
    </>
  );
}
