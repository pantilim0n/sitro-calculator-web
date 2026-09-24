export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=600');
  const raw=String(req.query?.url||'').trim();
  let u;
  try{u=new URL(raw.includes('://')?raw:'https://'+raw)}catch{return res.status(400).json({error:'Некорректная ссылка MakerWorld'})}
  if(u.hostname!=='makerworld.com'&&!u.hostname.endsWith('.makerworld.com'))return res.status(400).json({error:'Нужна ссылка makerworld.com'});
  const m=u.pathname.match(/\/models\/(\d+)/);
  if(!m)return res.status(400).json({error:'В ссылке не найден ID модели'});
  const designId=m[1];
  try{
    const r=await fetch('https://api.bambulab.com/v1/design-service/design/'+designId,{headers:{'Accept':'application/json','User-Agent':'SITRO-Calculator/1.0'}});
    if(!r.ok)return res.status(r.status).json({error:'MakerWorld вернул HTTP '+r.status});
    const d=await r.json();
    const instances=Array.isArray(d.instances)?d.instances:[];
    const profiles=instances.map(x=>({
      id:x.id??null,
      profileId:x.profileId??null,
      title:x.title||'Профиль печати',
      printer:x.printer?.name||x.printerName||x.deviceName||null,
      materialCnt:x.materialCnt??null,
      needAms:x.needAms??null,
      filaments:Array.isArray(x.instanceFilaments)?x.instanceFilaments:[],
      plates:Array.isArray(x.plates)?x.plates:[]
    }));
    return res.status(200).json({designId,title:d.title||'',coverUrl:d.coverUrl||'',modelId:d.modelId||'',profiles});
  }catch(e){return res.status(502).json({error:'Не удалось получить данные MakerWorld'})}
}