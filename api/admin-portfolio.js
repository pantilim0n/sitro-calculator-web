export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Метод не поддерживается'});
  const token=process.env.GITHUB_TOKEN;
  const adminPassword=process.env.ADMIN_PASSWORD;
  const repository=process.env.GITHUB_REPO||'pantilim0n/sitro-calculator-web';
  if(!token||!adminPassword) return res.status(503).json({error:'Админка ещё не настроена: добавьте GITHUB_TOKEN и ADMIN_PASSWORD в Vercel.'});
  const body=req.body||{};
  if(body.password!==adminPassword) return res.status(401).json({error:'Неверный пароль'});
  const [owner,name]=repository.split('/');
  if(/[^\x20-\x7E]/.test(token)) return res.status(503).json({error:'GITHUB_TOKEN в Vercel заполнен неверно: токен должен состоять только из латинских символов и цифр. Вставьте настоящий GitHub Personal Access Token.'});
  const headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'};
  const apiBase='https://api.github.com/repos/'+owner+'/'+name+'/contents/';
  async function getSha(path){
    const r=await fetch(apiBase+encodeURI(path),{headers});
    if(r.status===404)return null;
    if(!r.ok)throw new Error('GitHub: '+r.status);
    return (await r.json()).sha;
  }
  async function putFile(path,content,message){
    const sha=await getSha(path);
    const payload={message,content};
    if(sha)payload.sha=sha;
    const r=await fetch(apiBase+encodeURI(path),{method:'PUT',headers,body:JSON.stringify(payload)});
    if(!r.ok)throw new Error('GitHub: '+r.status+' '+await r.text());
    return await r.json();
  }
  try{
    if(body.action==='save'){
      if(!Array.isArray(body.items)) return res.status(400).json({error:'Некорректные данные портфолио'});
      const content=Buffer.from(JSON.stringify(body.items,null,2),'utf8').toString('base64');
      await putFile('portfolio.json',content,'Update portfolio from admin');
      return res.status(200).json({ok:true});
    }
    if(body.action==='saveCategories'){
      if(!Array.isArray(body.categories)) return res.status(400).json({error:'Некорректный список категорий'});
      const clean=[...new Set(body.categories.map(x=>String(x).trim()).filter(Boolean))];
      const content=Buffer.from(JSON.stringify(clean,null,2),'utf8').toString('base64');
      await putFile('portfolio-categories.json',content,'Update portfolio categories from admin');
      return res.status(200).json({ok:true});
    }
    if(body.action==='uploadOnly'){
      const {filename,dataBase64}=body;
      if(!filename||!dataBase64)return res.status(400).json({error:'Нет файла'});
      const safe=('portfolio/'+Date.now()+'-'+filename).replace(/[^a-zA-Z0-9._\-/]/g,'-');
      await putFile(safe,dataBase64,'Replace portfolio image');
      return res.status(200).json({ok:true,src:safe});
    }
    if(body.action==='upload'){
      const {filename,dataBase64,title,categories}=body;
      if(!filename||!dataBase64)return res.status(400).json({error:'Нет файла'});
      const safe=('portfolio/'+Date.now()+'-'+filename).replace(/[^a-zA-Z0-9._\-/]/g,'-');
      await putFile(safe,dataBase64,'Add portfolio image');
      const raw=await fetch('https://raw.githubusercontent.com/'+owner+'/'+name+'/main/portfolio.json',{cache:'no-store'});
      const items=raw.ok?await raw.json():[];
      items.push({id:'w'+Date.now(),src:safe,title:title||'3D-печать СИТРО',categories:Array.isArray(categories)&&categories.length?categories:['Прочее'],featured:false,visible:true,sort:items.length+1});
      const content=Buffer.from(JSON.stringify(items,null,2),'utf8').toString('base64');
      await putFile('portfolio.json',content,'Add portfolio item');
      return res.status(200).json({ok:true,src:safe});
    }
    return res.status(400).json({error:'Неизвестное действие'});
  }catch(e){return res.status(500).json({error:e.message||'Ошибка сохранения'});}
}