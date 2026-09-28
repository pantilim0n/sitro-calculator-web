const trigger=document.getElementById('previewChanges');

if(trigger){
  const style=document.createElement('style');
  style.textContent=`.admin-preview{position:fixed;inset:0;z-index:1000;display:none;padding:24px;background:#000d;overflow:auto}.admin-preview.open{display:block}.admin-preview-dialog{width:min(1040px,100%);margin:auto;border:1px solid #383838;border-radius:20px;background:#0c0e0f;box-shadow:0 30px 100px #000;padding:20px}.admin-preview-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0 18px;background:#0c0e0f}.admin-preview-head h2{margin:0}.admin-preview-close{background:#252525;color:#fff}.admin-preview-hero{min-height:320px;padding:46px clamp(22px,6vw,70px);display:flex;align-items:center;border-radius:16px;background:linear-gradient(90deg,#050708 0%,#050708e8 35%,#05070844 70%),url('/design-assets/hero-printing.jpg') right center/cover no-repeat}.admin-preview-hero div{max-width:520px}.admin-preview-hero h3{margin:8px 0;font-size:clamp(32px,6vw,58px);line-height:1}.admin-preview-hero p{color:#bbb}.admin-preview-label{color:#e9732f;font-weight:850;letter-spacing:.08em}.admin-preview-section{margin-top:20px}.admin-preview-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.admin-preview-card{padding:17px;border:1px solid #303438;border-radius:14px;background:#141719}.admin-preview-card b{display:block;margin-bottom:7px}.admin-preview-card span{color:#999;font-size:13px}.admin-preview-empty{padding:24px;color:#888;border:1px dashed #444;border-radius:14px}@media(max-width:700px){.admin-preview{padding:8px}.admin-preview-dialog{padding:12px}.admin-preview-grid{grid-template-columns:1fr}.admin-preview-hero{min-height:400px;align-items:flex-end;background-position:var(--preview-mobile-x,50%) center}}`;
  document.head.appendChild(style);
  const overlay=document.createElement('div');overlay.className='admin-preview';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Предпросмотр изменений');
  overlay.innerHTML='<div class="admin-preview-dialog"><div class="admin-preview-head"><h2>Предпросмотр до публикации</h2><button class="admin-preview-close" type="button">Закрыть</button></div><div id="adminPreviewContent"></div></div>';
  document.body.appendChild(overlay);
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const values=(selector,mapper)=>[...document.querySelectorAll(selector)].map(mapper);
  function render(){
    const mobileX=Number(document.getElementById('heroMobileX')?.value)||50;
    overlay.style.setProperty('--preview-mobile-x',mobileX+'%');
    const services=values('.service-admin-row',row=>({title:row.querySelector('.service-title')?.value,short:row.querySelector('.service-short')?.value,visible:row.querySelector('.service-visible-input')?.checked})).filter(item=>item.visible);
    const works=values('#rows .row',row=>({title:row.querySelector('.t')?.value,material:row.querySelector('.m')?.value,dimensions:row.querySelector('.z')?.value,leadTime:row.querySelector('.l')?.value,price:row.querySelector('.p')?.value,src:row.querySelector('img')?.getAttribute('src'),visible:row.querySelector('.v')?.checked})).filter(item=>item.visible).slice(0,6);
    const cards=services.map(item=>'<article class="admin-preview-card"><b>'+escape(item.title)+'</b><span>'+escape(item.short)+'</span></article>').join('');
    const portfolio=works.map(item=>'<article class="admin-preview-card">'+(item.src?'<img src="'+escape(item.src)+'" alt="" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;margin-bottom:10px">':'')+'<b>'+escape(item.title)+'</b><span>'+escape([item.material,item.dimensions,item.leadTime,item.price].filter(Boolean).join(' · '))+'</span></article>').join('');
    document.getElementById('adminPreviewContent').innerHTML='<section class="admin-preview-hero"><div><span class="admin-preview-label">ФАБРИКА 3D-ПЕЧАТИ · ЛИПЕЦК</span><h3>От идеи до готовой детали в 3D</h3><p>Так будет выглядеть направление первого экрана и положение фоновой фотографии.</p></div></section><section class="admin-preview-section"><h3>Услуги</h3><div class="admin-preview-grid">'+(cards||'<div class="admin-preview-empty">Нет включённых услуг</div>')+'</div></section><section class="admin-preview-section"><h3>Портфолио</h3><div class="admin-preview-grid">'+(portfolio||'<div class="admin-preview-empty">Нет видимых работ</div>')+'</div></section>';
  }
  trigger.addEventListener('click',()=>{render();overlay.classList.add('open');document.body.style.overflow='hidden';overlay.querySelector('.admin-preview-close').focus()});
  const close=()=>{overlay.classList.remove('open');document.body.style.removeProperty('overflow');trigger.focus()};
  overlay.querySelector('.admin-preview-close').addEventListener('click',close);
  overlay.addEventListener('click',event=>{if(event.target===overlay)close()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&overlay.classList.contains('open'))close()});
}
