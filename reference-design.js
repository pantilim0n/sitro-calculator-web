(() => {
  const SETTINGS = {
    accent: '#FF6A00',
    hero: '/reference-assets/hero-printing.webp',
    logo: '/reference-assets/sitro-logo.webp',
    benefits: [
      {icon:'/reference-assets/icon-cube.svg', title:'Высокая точность', note:'Аккуратная печать деталей'},
      {icon:'/reference-assets/icon-materials.svg', title:'Широкий выбор материалов', note:'PLA, PETG, ABS, ASA, PA'},
      {icon:'/reference-assets/icon-speed.svg', title:'Быстрые сроки', note:'Срок зависит от модели'},
      {icon:'/reference-assets/icon-clients.svg', title:'Для бизнеса и частных клиентов', note:'От одной детали до малой серии'}
    ]
  };

  const css = `
  :root{--ref-orange:#FF6A00;--ref-black:#080909;--ref-surface:#0D0E0E;--ref-white:#F5F5F5;--ref-muted:#C4C4C4}
  body{background:var(--ref-black)}
  header.top{background:#080909f7!important;border-bottom:1px solid #252525!important;backdrop-filter:blur(12px)}
  header.top>.wrap{max-width:1280px!important;padding-left:28px!important;padding-right:28px!important}
  header.top nav{min-height:128px!important;display:grid!important;grid-template-columns:270px 1fr auto!important;align-items:center!important;gap:30px!important}
  .brand{width:250px!important;height:88px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;overflow:hidden!important}
  .brand img{display:block!important;width:245px!important;height:88px!important;max-width:none!important;object-fit:contain!important;opacity:1!important}
  .menu{display:flex!important;justify-content:center!important;align-items:center!important;gap:28px!important;color:#d7d7d7!important;font-size:14px!important;white-space:nowrap}
  .menu a{transition:color .18s ease}
  .menu a:hover,.menu a.active{color:var(--ref-orange)!important}
  .header-actions{margin:0!important}
  .ref-header-cta{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 19px;border:1px solid var(--ref-orange);border-radius:6px;color:var(--ref-orange);background:#0b0b0b;font-weight:800;font-size:14px;white-space:nowrap}
  .ref-header-cta:hover{background:var(--ref-orange);color:#080909}
  .mobile-menu-button{display:none!important}

  .hero.ref-hero{position:relative!important;padding:0!important;background:var(--ref-black)!important;overflow:hidden!important;border-bottom:1px solid #202020}
  .hero.ref-hero:before,.hero.ref-hero:after{display:none!important}
  .ref-hero-stage{position:relative;min-height:570px;background-image:linear-gradient(90deg,#080909 0%,#080909f7 27%,#080909c9 43%,rgba(8,9,9,.34) 61%,rgba(8,9,9,.04) 78%),linear-gradient(0deg,#080909 0%,rgba(8,9,9,0) 24%),url("${SETTINGS.hero}");background-size:cover;background-position:center center;background-repeat:no-repeat}
  .ref-hero-stage>.wrap{max-width:1280px!important;min-height:570px;display:flex;align-items:center;padding-left:28px!important;padding-right:28px!important}
  .ref-hero-copy{position:relative;z-index:2;width:56%;max-width:690px;padding:54px 0 46px}
  .ref-kicker{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:20px;font-size:12px;font-weight:850;letter-spacing:.09em;text-transform:uppercase;color:#bdbdbd}
  .ref-kicker strong{color:var(--ref-orange)}
  .ref-hero h1{margin:0!important;max-width:680px!important;color:var(--ref-white)!important;font-size:clamp(60px,5.05vw,72px)!important;font-weight:850!important;line-height:.98!important;letter-spacing:-.045em!important}
  .ref-hero h1>span{display:block}
  .ref-hero h1 em{color:var(--ref-orange);font-style:normal}
  .ref-lead{max-width:610px!important;margin:22px 0 0!important;color:var(--ref-muted)!important;font-size:19px!important;line-height:1.48!important}
  .ref-actions{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:30px}
  .ref-actions .btn{min-height:60px!important;padding:0 25px!important;border-radius:6px!important;font-size:15px!important;font-weight:850!important}
  .ref-actions .primary{background:var(--ref-orange)!important;color:#080909!important}
  .ref-actions .secondary{border:1px solid #555!important;background:#0b0c0cdd!important;color:#fff!important}
  .ref-play{display:inline-grid;place-items:center;width:28px;height:28px;margin-right:9px;border:2px solid var(--ref-orange);border-radius:50%;color:var(--ref-orange);font-size:11px;line-height:1;padding-left:2px}

  .ref-benefit-strip{background:#090a0a;border-top:1px solid #262626}
  .ref-benefits{max-width:1280px!important;min-height:154px;display:grid;grid-template-columns:repeat(4,1fr);align-items:stretch;padding:0 28px!important}
  .ref-benefit{display:grid;grid-template-columns:50px 1fr;gap:15px;align-content:center;align-items:start;padding:30px 27px;border-right:1px solid #2b2b2b}
  .ref-benefit:first-child{padding-left:0}
  .ref-benefit:last-child{border-right:0;padding-right:0}
  .ref-benefit img{width:43px;height:43px;object-fit:contain}
  .ref-benefit b{display:block;color:#f1f1f1;font-size:15px;line-height:1.25}
  .ref-benefit span{display:block;margin-top:6px;color:#929292;font-size:12px;line-height:1.35}
  #sitroTrust{display:none!important}

  @media(max-width:1180px){
    header.top nav{min-height:104px!important;grid-template-columns:220px 1fr auto!important;gap:18px!important}
    .brand{width:215px!important;height:72px!important}.brand img{width:210px!important;height:72px!important}
    .menu{gap:18px!important;font-size:13px!important}
    .ref-header-cta{min-height:44px;padding:0 14px;font-size:13px}
    .ref-hero-stage,.ref-hero-stage>.wrap{min-height:520px}
    .ref-hero h1{font-size:clamp(51px,5.5vw,62px)!important}
    .ref-lead{font-size:17px!important;max-width:540px!important}
    .ref-actions .btn{min-height:54px!important;padding:0 20px!important}
    .ref-benefits{min-height:138px}
    .ref-benefit{padding:25px 18px;grid-template-columns:42px 1fr;gap:12px}
    .ref-benefit img{width:38px;height:38px}
  }

  @media(max-width:930px){
    header.top nav{grid-template-columns:200px 1fr auto!important}
    .brand{width:195px!important}.brand img{width:190px!important}
    .menu{display:none!important}
    .header-actions{justify-self:end}
    .mobile-menu-button{display:block!important;position:static!important;justify-self:end;width:44px!important;height:44px!important;margin-left:8px;border:1px solid #444!important;border-radius:8px!important;background:#111!important;color:#fff!important;font-size:23px!important}
    .header-actions{display:flex!important;align-items:center!important;gap:8px!important}
    .ref-hero-copy{width:62%}
    .ref-benefit b{font-size:13px}
  }

  @media(max-width:760px){
    header.top>.wrap{padding-left:16px!important;padding-right:16px!important}
    header.top nav{min-height:90px!important;display:flex!important;justify-content:space-between!important;gap:12px!important}
    .brand{width:180px!important;height:64px!important}.brand img{width:176px!important;height:64px!important}
    .header-actions{display:none!important}
    .mobile-menu-button{display:block!important;position:fixed!important;top:23px!important;right:16px!important;z-index:200!important}
    .mobile-menu{top:90px!important;background:#090a0af7!important;border-top:1px solid #2a2a2a!important}
    .mobile-menu a{min-height:48px;display:flex;align-items:center;padding:0 18px!important}
    .ref-hero-stage{min-height:0;padding-top:238px;background-image:linear-gradient(0deg,#080909 0%,rgba(8,9,9,.12) 36%,rgba(8,9,9,.04) 100%),url("${SETTINGS.hero}");background-size:auto 250px;background-position:63% 0;background-repeat:no-repeat}
    .ref-hero-stage>.wrap{min-height:0!important;padding:0 16px!important;display:block}
    .ref-hero-copy{width:100%;max-width:none;padding:0 0 30px}
    .ref-kicker{display:none}
    .ref-hero h1{font-size:clamp(38px,10.8vw,42px)!important;line-height:1.02!important;letter-spacing:-.035em!important;max-width:360px!important}
    .ref-hero h1>span:first-child{max-width:320px}
    .ref-lead{margin-top:17px!important;font-size:15.5px!important;line-height:1.48!important;max-width:355px!important}
    .ref-actions{display:grid;grid-template-columns:1fr;gap:10px;margin-top:23px}
    .ref-actions .btn{width:100%!important;min-height:54px!important}
    .ref-benefits{grid-template-columns:1fr 1fr;min-height:0;padding:0 14px!important}
    .ref-benefit{min-height:112px;padding:20px 12px!important;border-right:0;border-bottom:1px solid #272727;grid-template-columns:40px 1fr;gap:10px}
    .ref-benefit:nth-child(odd){border-right:1px solid #272727}
    .ref-benefit:nth-last-child(-n+2){border-bottom:0}
    .ref-benefit img{width:35px;height:35px}
    .ref-benefit b{font-size:12px}
    .ref-benefit span{display:none}
  }
  @media(max-width:390px){
    .ref-hero-stage{padding-top:222px;background-size:auto 236px;background-position:64% 0}
    .ref-hero h1{font-size:39px!important}
  }`;

  function apply(){
    if(document.getElementById('reference-prompt-style')) return;
    const style=document.createElement('style');
    style.id='reference-prompt-style';
    style.textContent=css;
    document.head.appendChild(style);

    const brand=document.querySelector('.brand img');
    if(brand){brand.src=SETTINGS.logo;brand.alt='СИТРО — фабрика 3D-печати';}

    const menu=document.querySelector('header .menu');
    if(menu){
      menu.innerHTML='<a href="#services">Услуги</a><a href="#materials">Материалы</a><a href="#portfolio">Примеры работ</a><a href="#calculator">Калькулятор</a><a href="#contacts">Контакты</a>';
    }
    const mobile=document.getElementById('mobileMenu');
    if(mobile){
      mobile.innerHTML='<a href="#services">Услуги</a><a href="#materials">Материалы</a><a href="#portfolio">Примеры работ</a><a href="#calculator">Калькулятор</a><a href="#contacts">Контакты</a><a href="#faq">Частые вопросы</a>';
      mobile.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>mobile.classList.remove('open')));
    }

    const actions=document.querySelector('.header-actions');
    if(actions) actions.innerHTML='<a class="ref-header-cta" href="#calculator">Оставить заявку</a>';

    const hero=document.querySelector('.hero');
    if(hero){
      hero.className='hero ref-hero';
      hero.innerHTML=`
        <div class="ref-hero-stage">
          <div class="wrap">
            <div class="ref-hero-copy">
              <div class="ref-kicker"><strong>3D-ПЕЧАТЬ</strong><span>/</span><span>ПРОТОТИПИРОВАНИЕ</span><span>/</span><span>СЕРИЙНОЕ ПРОИЗВОДСТВО</span></div>
              <h1><span>От идеи до готовой</span><span>детали в <em>3D</em></span></h1>
              <p class="ref-lead">Профессиональная 3D-печать и инженерная поддержка для ваших проектов. Точные детали, надежные материалы, быстрые сроки.</p>
              <div class="ref-actions">
                <a class="btn primary" href="#calculator">Рассчитать стоимость <span>→</span></a>
                <a class="btn secondary" href="#portfolio"><span class="ref-play" aria-hidden="true">▶</span>Смотреть работы</a>
              </div>
            </div>
          </div>
        </div>
        <div class="ref-benefit-strip">
          <div class="wrap ref-benefits">
            ${SETTINGS.benefits.map(x=>`<div class="ref-benefit"><img src="${x.icon}" alt=""><div><b>${x.title}</b><span>${x.note}</span></div></div>`).join('')}
          </div>
        </div>`;
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else queueMicrotask(apply);
})();