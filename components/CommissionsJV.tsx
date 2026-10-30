'use client';

import { useEffect, useState } from 'react';
import { Receipt, RefreshCw, ExternalLink, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Sale = { row: number; commercial: string; vehicle: string; margin_ttc: number; margin_ht: number; guarantee: string; guarantee_ht: number; cash_ht: number; base_ht: number; commission_ht: number };
type Snapshot = { month_start: string; checked_at: string; source_modified_at: string | null; total_ht: number; total_vat: number; total_ttc: number; rows: Sale[] };
const source = 'https://docs.google.com/spreadsheets/d/1p0FoXI9JbB-t_MjgGdSuyOkAoNdnH95j/edit';
const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const euros = (n: number) => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n);
const dateTime = (s: string) => new Date(s).toLocaleString('fr-FR',{timeZone:'Europe/Paris',dateStyle:'short',timeStyle:'short'});

export default function CommissionsJV() {
 const parts = new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',year:'numeric',month:'numeric'}).formatToParts(new Date());
 const [year,setYear] = useState(Number(parts.find(p=>p.type==='year')?.value));
 const [month,setMonth] = useState(Number(parts.find(p=>p.type==='month')?.value));
 const [snapshot,setSnapshot] = useState<Snapshot|null>(null);
 const [loading,setLoading] = useState(true);
 const [error,setError] = useState('');
 const [refresh,setRefresh] = useState(0);
 useEffect(()=>{const id=setInterval(()=>setRefresh(n=>n+1),60000);return ()=>clearInterval(id);},[]);
 useEffect(()=>{
  let cancelled=false;setLoading(true);setError('');setSnapshot(null);
  async function load(){
   const {data,error:err}=await supabase.from('jv_commission_months').select('*').eq('agency_id',2).eq('month_start',`${year}-${String(month).padStart(2,'0')}-01`).maybeSingle();
   if(cancelled)return;
   if(err)setError('Impossible de lire les commissions. Réessaie ou vérifie les droits de ton compte responsable.');
   else setSnapshot(data as Snapshot|null);
   setLoading(false);
  }
  load();return ()=>{cancelled=true;};
 },[year,month,refresh]);
 const stale=snapshot && Date.now()-new Date(snapshot.checked_at).getTime()>25*3600000;
 return <div style={{display:'grid',gap:18}}>
  <section className="card">
   <div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap',alignItems:'center'}}>
    <div><h3 style={{display:'flex',alignItems:'center',gap:8}}><Receipt size={21}/> Commissions JV</h3><p className="muted">Le détail des commissions de Tours, prêt pour préparer la refacturation.</p></div>
    <a href={source} target="_blank" rel="noreferrer" style={{color:'#93c5fd',display:'flex',gap:7,alignItems:'center'}}><ExternalLink size={16}/> Ouvrir le fichier source</a>
   </div>
   <div style={{display:'flex',flexWrap:'wrap',gap:14,marginTop:18,alignItems:'end'}}>
    <label style={{display:'grid',gap:6}}>Agence<select aria-label="Agence" value="tours" onChange={()=>{}}><option value="tours">Tours</option></select></label>
    <label style={{display:'grid',gap:6}}>Mois<select value={month} onChange={e=>setMonth(Number(e.target.value))}>{months.map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select></label>
    <label style={{display:'grid',gap:6}}>Année<select value={year} onChange={e=>setYear(Number(e.target.value))}>{Array.from({length:Math.max(3,new Date().getFullYear()-2026+3)},(_,i)=>2026+i).map(y=><option key={y} value={y}>{y}</option>)}</select></label>
    <button onClick={()=>setRefresh(n=>n+1)} disabled={loading} style={{display:'flex',gap:7,alignItems:'center'}}><RefreshCw size={16}/> Actualiser l’affichage</button>
   </div>
   <p className="muted" style={{fontSize:13,marginTop:16}}>Lecture du fichier Drive à 12 h et 19 h, heure de Paris. Seules les modifications enregistrées dans cette version en ligne sont récupérées.</p>
  </section>
  {loading?<div className="card" role="status">Chargement des commissions…</div>:error?<div className="card" role="alert" style={{color:'#fca5a5'}}>{error}</div>:!snapshot?<div className="card"><h3>Aucune synchronisation pour cette période</h3><p className="muted">Aucun montant disponible pour {months[month-1]} {year}. Vérifie que l’onglet correspondant existe dans le fichier source.</p></div>:<>
   <section className="card" style={{border:'1px solid rgba(52,211,153,.4)',background:'linear-gradient(125deg,rgba(6,78,59,.65),rgba(15,23,42,.95))'}}>
    <p style={{color:'#a7f3d0',fontWeight:700,margin:'0 0 10px'}}>MONTANT À FACTURER HT · TOURS · {months[month-1].toUpperCase()} {year}</p>
    <div style={{fontSize:'clamp(36px,6vw,60px)',fontWeight:800,letterSpacing:'-1px'}}>{euros(Number(snapshot.total_ht))}</div>
    <div style={{display:'flex',gap:32,flexWrap:'wrap',marginTop:18}}><div><span className="muted">TVA</span><p style={{fontSize:22,fontWeight:700,marginTop:6}}>{euros(Number(snapshot.total_vat))}</p></div><div><span className="muted">Total TTC</span><p style={{fontSize:22,fontWeight:700,marginTop:6}}>{euros(Number(snapshot.total_ttc))}</p></div><div><span className="muted">Lignes renseignées</span><p style={{fontSize:22,fontWeight:700,marginTop:6}}>{snapshot.rows.length}</p></div></div>
    <p className="muted" style={{fontSize:13}}>Dernier contrôle réussi : {dateTime(snapshot.checked_at)}{snapshot.source_modified_at?` · Fichier modifié le ${dateTime(snapshot.source_modified_at)}`:''}.</p>
    {stale&&<p role="alert" style={{color:'#fcd34d',fontWeight:700}}>Données à vérifier : aucun contrôle réussi depuis plus de 25 heures.</p>}
   </section>
   <section className="card"><h3>Comment le montant est calculé</h3><p className="muted">Pour chaque véhicule : marge HT − part de garantie HT − part CashSentinel HT = base nette. La commission correspond à 8 % de cette base, selon les paramètres du fichier source. Les montants sont contrôlés avant import.</p></section>
   <section><h3>Détail des véhicules</h3>{snapshot.rows.length===0?<div className="card">Aucune vente renseignée pour ce mois. Le total du fichier est de 0 €.</div>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,340px),1fr))',gap:14}}>{snapshot.rows.map(s=><article key={s.row} className="card">
    <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:'start'}}><div><h3 style={{margin:'0 0 6px',textTransform:'capitalize'}}>{s.vehicle}</h3><span className="muted" style={{textTransform:'capitalize'}}>{s.commercial}</span></div><div style={{textAlign:'right'}}><span className="muted" style={{fontSize:12}}>Commission HT</span><div style={{fontSize:24,fontWeight:800,color:'#6ee7b7',marginTop:5}}>{euros(s.commission_ht)}</div></div></div>
    <details style={{marginTop:18}}><summary style={{cursor:'pointer',color:'#93c5fd'}}>Voir le calcul <ChevronDown size={14} style={{verticalAlign:'middle'}}/></summary><dl style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,marginTop:16}}>{[['Marge véhicule TTC',s.margin_ttc],['Marge véhicule HT',s.margin_ht],['Garantie retenue HT',s.guarantee_ht],['CashSentinel retenu HT',s.cash_ht],['Base nette HT',s.base_ht]].map(([label,value])=><div key={String(label)} style={{display:'contents'}}><dt className="muted">{label}</dt><dd style={{margin:0,textAlign:'right'}}>{euros(Number(value))}</dd></div>)}</dl><p className="muted" style={{fontSize:12}}>{s.guarantee||'Garantie non sélectionnée (0 € selon le fichier)'} · Ligne {s.row} du fichier source.</p></details>
   </article>)}</div>}</section>
  </>}
 </div>;
}
