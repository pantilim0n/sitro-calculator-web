function n(v){const x=Number(v);return Number.isFinite(x)?x:null}
function first(obj,keys){for(const k of keys){if(obj&&obj[k]!=null)return obj[k]}return null}
function seconds(v){if(v==null)return null;if(typeof v==='number')return v;const s=String(v).trim();if(/^\d+(\.\d+)?$/.test(s))return Number(s);let t=0;const h=s.match(/(\d+(?:\.\d+)?)\s*h/i),m=s.match(/(\d+(?:\.\d+)?)\s*m/i),sec=s.match(/(\d+(?:\.\d+)?)\s*s/i);if(h)t+=Number(h[1])*3600;if(m)t+=Number(m[1])*60;if(sec)t+=Number(sec[1]);return t||null}
function grams(v){const x=n(v);return x==null?null:x}
function weightOf(o){return grams(first(o,['weight','usedWeight','filamentWeight','weightGrams','used_g','usedG','usedGrams','used_grams']))}
function normalizeFilament(f){return {type:first(f,['type','filamentType','material','name']),color:first(f,['color','filamentColor','colour']),weightGrams:weightOf(f)}}
function normalizePlate(p){
 const pf=Array.isArray(p.filaments)?p.filaments:Array.isArray(p.instanceFilaments)?p.instanceFilaments:[];
 const direct=weightOf(p);
 const byFilaments=pf.reduce((a,f)=>a+(weightOf(f)||0),0)||null;
 return {index:first(p,['index','plateIndex','plate_index']),name:first(p,['name','title']),printTimeSeconds:seconds(first(p,['prediction','printTime','print_time','time','printTimeSeconds'])),weightGrams:direct||byFilaments,filaments:pf.map(normalizeFilament)}
}
function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'s-maxage=300, stale-while-revalidate=600'}})}

export default {
 async fetch(request){
  const requestUrl=new URL(request.url);
  const raw=String(requestUrl.searchParams.get('url')||'').trim();
  let u;
  try{u=new URL(raw.includes('://')?raw:'https://'+raw)}catch{return json({error:'Некорректная ссылка MakerWorld'},400)}
  if(u.hostname!=='makerworld.com'&&!u.hostname.endsWith('.makerworld.com'))return json({error:'Нужна ссылка makerworld.com'},400);
  const m=u.pathname.match(/\/models\/(\d+)/);if(!m)return json({error:'В ссылке не найден ID модели'},400);
  const designId=m[1];
  try{
   const r=await fetch('https://api.bambulab.com/v1/design-service/design/'+designId,{headers:{Accept:'application/json','User-Agent':'SITRO-Calculator/1.0'}});
   if(!r.ok)return json({error:'MakerWorld вернул HTTP '+r.status},r.status);
   const d=await r.json(),instances=Array.isArray(d.instances)?d.instances:[];
   const profiles=instances.map(x=>{
    const rawPlates=Array.isArray(x.plates)?x.plates:[];
    const plates=rawPlates.map(normalizePlate);
    const fils=Array.isArray(x.instanceFilaments)?x.instanceFilaments:[];
    const plateTime=plates.reduce((a,p)=>a+(p.printTimeSeconds||0),0)||null;
    const directTime=seconds(first(x,['prediction','printTime','print_time','time','printTimeSeconds','estimatedTime']));
    const directWeight=weightOf(x);
    const filamentWeight=fils.reduce((a,f)=>a+(weightOf(f)||0),0)||null;
    const plateWeight=plates.reduce((a,p)=>a+(p.weightGrams||0),0)||null;
    const picture=Array.isArray(x.pictures)&&x.pictures.length?(typeof x.pictures[0]==='string'?x.pictures[0]:first(x.pictures[0],['url','imageUrl','coverUrl'])):null;
    const plateCover=rawPlates.length?first(rawPlates[0],['cover','coverUrl','thumbnail','thumbnailUrl','imageUrl','image']):null;
    return {id:x.id??null,profileId:x.profileId??null,title:x.title||'Профиль печати',coverUrl:first(x,['cover','coverUrl','thumbnailUrl','thumbnail','imageUrl','image'])||picture||plateCover,printer:x.printer?.name||x.printerName||x.deviceName||null,materialCnt:x.materialCnt??null,needAms:x.needAms??null,printTimeSeconds:directTime||plateTime,totalWeightGrams:directWeight||filamentWeight||plateWeight,filaments:fils.map(normalizeFilament),plates};
   });
   return json({designId,title:d.title||'',coverUrl:d.coverUrl||'',modelId:d.modelId||'',profiles});
  }catch(e){return json({error:'Не удалось получить данные MakerWorld'},502)}
 }
};
