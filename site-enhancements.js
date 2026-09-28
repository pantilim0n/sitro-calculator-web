const fallbackConfig={
  phoneLabel:'+7 905 688-44-43',
  phoneUrl:'tel:+79056884443',
  address:'Липецк, ул. Свиридова, 9, 2 этаж',
  addressNote:'Рынок «Европейский». Встречи по предварительной договорённости.',
  routeUrl:'https://yandex.ru/maps/?rtext=~52.578173,39.510493&rtt=automt',
  city:'Липецк',
  region:'Липецкая область'
};

async function fetchJson(path,fallback){
  try{const response=await fetch(path+'?v='+Date.now(),{cache:'no-store'});return response.ok?await response.json():fallback}catch{return fallback}
}

function text(value){return String(value??'').trim()}

function updateContact(config){
  document.querySelectorAll('.header-contact').forEach(link=>{
    link.href=config.phoneUrl||fallbackConfig.phoneUrl;
    const label=link.querySelector('span:last-child');if(label)label.textContent=config.phoneLabel||fallbackConfig.phoneLabel;
  });
  const contact=document.querySelector('#contacts .contact');
  const address=contact?.querySelector('.contact-address');
  if(!contact||!address)return;
  let primary=contact.querySelector('.contact-primary');
  if(!primary){primary=document.createElement('div');primary.className='contact-primary';const heading=contact.querySelector('h2');contact.insertBefore(primary,contact.firstChild);if(heading)primary.appendChild(heading);primary.insertAdjacentHTML('beforeend','<p class="contact-lead">Напишите удобным способом или приезжайте за готовым заказом.</p>');primary.appendChild(address)}
  const addressText=[...address.children].find(element=>element.tagName==='SPAN'&&!element.classList.contains('address-pin'));
  if(addressText){addressText.classList.add('contact-address-text');addressText.textContent=config.address||fallbackConfig.address}
  let note=address.querySelector('.contact-address-note');
  if(!note){note=document.createElement('span');note.className='contact-address-note';address.querySelector('.route-link')?.before(note)}
  note.textContent=config.addressNote||'';note.hidden=!note.textContent;
  const route=address.querySelector('.route-link');if(route)route.href=config.routeUrl||fallbackConfig.routeUrl;
}

function updateStructuredData(config){
  const node=document.querySelector('script[type="application/ld+json"]:not(#portfolioStructuredData)');if(!node)return;
  let data={};try{data=JSON.parse(node.textContent)}catch{}
  Object.assign(data,{
    '@context':'https://schema.org','@type':'LocalBusiness',name:'СИТРО — фабрика 3D-печати',
    description:'3D-печать и моделирование на заказ в Липецке: технические детали, корпуса, сувениры и малые серии.',
    telephone:config.phoneLabel||fallbackConfig.phoneLabel,url:location.origin+'/',priceRange:'₽₽',
    areaServed:[{'@type':'City',name:config.city||'Липецк'},{'@type':'Country',name:'Россия'}],
    address:{'@type':'PostalAddress',streetAddress:(config.address||'').replace(/^Липецк,\s*/i,''),addressLocality:config.city||'Липецк',addressRegion:config.region||'Липецкая область',addressCountry:'RU'},
    geo:{'@type':'GeoCoordinates',latitude:52.578173,longitude:39.510493},
    sameAs:['https://t.me/sitro48','https://vk.ru/sitmaker']
  });
  node.textContent=JSON.stringify(data);
}

function updateTrust(){
  const grid=document.querySelector('#sitroTrust .trust-grid');if(!grid)return;
  grid.innerHTML='<div class="trust-item"><strong>1–2 мин</strong><b>Предварительный расчёт</b><span>ориентировочная цена онлайн</span></div><div class="trust-item"><strong>До печати</strong><b>Согласовываем заказ</b><span>модель, материал и стоимость</span></div><div class="trust-item"><strong>Контроль</strong><b>Проверяем изделие</b><span>до выдачи или отправки</span></div><div class="trust-item"><strong>Липецк + РФ</strong><b>Самовывоз и доставка</b><span>согласуем удобный вариант</span></div><p class="trust-note">Точный срок и итоговую стоимость подтверждаем после проверки модели.</p>';
}

function renderReviews(data){
  const items=(Array.isArray(data?.items)?data.items:[]).filter(item=>item&&item.visible!==false&&text(item.name)&&text(item.text));
  document.getElementById('reviews')?.remove();if(!items.length)return;
  const section=document.createElement('section');section.id='reviews';section.className='reviews-section';
  const wrap=document.createElement('div');wrap.className='wrap';wrap.innerHTML='<h2 class="title">Отзывы заказчиков</h2><p class="sub">Реальные впечатления о выполненных работах.</p>';
  const grid=document.createElement('div');grid.className='reviews-grid';
  items.sort((a,b)=>(Number(a.sort)||0)-(Number(b.sort)||0)).forEach(item=>{
    const card=document.createElement('article');card.className='review-card';
    const head=document.createElement('div');head.className='review-head';
    if(text(item.photo)){const image=document.createElement('img');image.className='review-photo';image.src=item.photo;image.alt='Работа для '+item.name;image.loading='lazy';head.appendChild(image)}else{const avatar=document.createElement('span');avatar.className='review-avatar';avatar.textContent=item.name.slice(0,1).toUpperCase();head.appendChild(avatar)}
    const who=document.createElement('div');const name=document.createElement('strong');name.className='review-name';name.textContent=item.name;who.appendChild(name);
    if(text(item.meta)){const meta=document.createElement('span');meta.className='review-meta';meta.textContent=item.meta;who.appendChild(meta)}head.appendChild(who);
    const quote=document.createElement('p');quote.className='review-text';quote.textContent=item.text;card.append(head,quote);
    if(text(item.source)&&text(item.sourceUrl)){const source=document.createElement('a');source.className='review-source';source.href=item.sourceUrl;source.target='_blank';source.rel='noopener';source.textContent='Отзыв на '+item.source+' ↗';card.appendChild(source)}
    grid.appendChild(card);
  });
  wrap.appendChild(grid);section.appendChild(wrap);document.querySelector('#faq')?.before(section);
}

function addEditButton(result,target){
  if(!result||result.querySelector('.quote-edit'))return;
  const button=document.createElement('button');button.type='button';button.className='quote-edit';button.textContent='Изменить параметры';button.onclick=()=>target?.scrollIntoView({behavior:'smooth',block:'center'});result.appendChild(button);
}

function enhanceCalculator(){
  const calc=document.querySelector('#calculator .calc');const maker=document.getElementById('calcResult');const stl=document.getElementById('stlResult');if(!calc)return;
  const price=document.getElementById('priceOut');if(maker&&price&&maker.firstElementChild!==price)maker.insertBefore(price,maker.firstElementChild);
  addEditButton(maker,document.querySelector('.calc-mode-tabs'));
  const enhanceStl=()=>{if(!stl||stl.style.display==='none')return;const summary=stl.querySelector('.stl-summary');if(summary&&!stl.querySelector('.stl-total-price')){const matches=summary.textContent.match(/Предварительно по заказу:\s*≈?\s*([\d\s]+\s*₽)/i);if(matches){const total=document.createElement('div');total.className='stl-total-price';total.textContent='Предварительно '+matches[1].trim();stl.insertBefore(total,stl.firstChild)}}addEditButton(stl,document.getElementById('stlFields'))};
  if(stl)new MutationObserver(enhanceStl).observe(stl,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});
}

function improvePortfolioOrder(){
  const button=document.getElementById('lightboxOrder');if(!button)return;
  button.addEventListener('click',()=>{const title=text(document.getElementById('lightboxTitle')?.textContent);const comment=document.getElementById('stlCustomerComment');if(title&&comment&&!comment.value.trim())comment.value='Хочу заказать похожее изделие: '+title;sessionStorage.setItem('sitroPortfolioInterest',title)});
}

const [config,reviews]=await Promise.all([fetchJson('/site-config.json',fallbackConfig),fetchJson('/reviews.json',{items:[]})]);
updateContact({...fallbackConfig,...config});updateStructuredData({...fallbackConfig,...config});updateTrust();renderReviews(reviews);enhanceCalculator();improvePortfolioOrder();
