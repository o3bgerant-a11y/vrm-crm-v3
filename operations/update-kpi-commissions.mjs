import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(process.argv[2]));
const input=JSON.parse(await fs.readFile(process.argv[3],'utf8'));
const s=wb.worksheets.getItem(process.argv[4]);
const tariffs=wb.worksheets.getItem('Tarifs garanties').getRange('A2:A8').values.map(r=>r[0]);
if(input.length>45)throw Error('Capacité du modèle dépassée');
const mapped=input.map(([name,vehicle,margin,guarantee])=>{
const key=tariffs.find(x=>x.split(' — ')[0].toLowerCase()===guarantee.toLowerCase());
if(!key)throw Error('Garantie inconnue : '+guarantee);return [name,vehicle,margin,key];});
s.getRange('A8:C52').clear({applyTo:'contents'});s.getRange('E8:E52').clear({applyTo:'contents'});
mapped.forEach((r,i)=>{s.getRange(`A${i+8}:C${i+8}`).values=[r.slice(0,3)];s.getRange(`E${i+8}`).values=[[r[3]]];});
for(let r=8;r<=52;r++){
s.getRange(`D${r}`).formulas=[[`=IF(ISBLANK(C${r}),"",ROUND(C${r}/(1+$D$5),2))`]];
s.getRange(`F${r}`).formulas=[['=ROUND($F$5/(1+$D$5)*$H$5,2)']];
s.getRange(`G${r}`).formulas=[[`=IF(ISBLANK(C${r}),"",ROUND(D${r}-IF(E${r}="",0,VLOOKUP(E${r},'Tarifs garanties'!$A$2:$C$8,3,FALSE))-F${r},2))`]];
s.getRange(`H${r}`).formulas=[[`=IF(ISBLANK(C${r}),"",ROUND(G${r}*$B$5,2))`]];
}
s.getRange('H54:H56').formulas=[['=SUM(H8:H52)'],['=ROUND(H54*$D$5,2)'],['=H54+H55']];
wb.recalculate();
console.log((await wb.inspect({kind:'table',range:`'${process.argv[4].replaceAll("'","''")}'!G54:H56`,include:'values,formulas',maxChars:1000})).ndjson);
await (await SpreadsheetFile.exportXlsx(wb)).save(process.argv[5]);
