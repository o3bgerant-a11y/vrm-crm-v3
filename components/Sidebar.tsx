'use client';
import { BarChart3, CalendarDays, Car, FileText, Gauge, Home, Megaphone, ShieldCheck, Store, Users } from 'lucide-react';
const items = [
  ['dashboard','Tableau de bord',Home],['planning','Planning Benoît',CalendarDays],['agences','Agences',Store],['agents','Agents commerciaux',Users],['ventes','Ventes',Car],['garanties','Garanties',ShieldCheck],['messages','Messages Direction',Megaphone],['documents','Documents',FileText],['stats','Statistiques',BarChart3]
] as const;
export default function Sidebar({active,setActive}:{active:string,setActive:(v:string)=>void}){return <aside className="sidebar"><div className="brand"><div className="logo"><Gauge size={28}/></div><div><h1>Vroom Market</h1><p>CRM V3</p></div></div><div className="nav">{items.map(([id,label,Icon])=><button key={id} onClick={()=>setActive(id)} className={active===id?'active':''}><Icon size={18}/>{label}</button>)}</div></aside>}
