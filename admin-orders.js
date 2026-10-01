const adminApp=document.getElementById('adminApp');
const backupTools=adminApp?.querySelector('.backup-tools');
const statusLabels={new:'Новая',contacted:'Связались',in_progress:'В работе',ready:'Готово',cancelled:'Отменена'};
let orders=[];
let ordersLoaded=false;

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const safeUrl=value=>{try{const url=new URL(String(value||''));return url.protocol==='https:'?url.href:''}catch{return ''}};
const dateLabel=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'Дата не указана':new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(date)};
const telUrl=value=>{const cleaned=String(value||'').replace(/[^\d+]/g,'');return cleaned.length>=6?'tel:'+cleaned:''};

function notificationBadge(name,state){
  if(!state)return '<span class="order-notice">'+name+': нет данных</span>';
  if(!state?.configured)return '<span class="order-notice">'+name+': не настроен</span>';
  if(state.sent)return '<span class="order-notice sent">'+name+': доставлено</span>';
  return '<span class="order-notice failed" title="'+esc(state.error||'Не доставлено')+'">'+name+': повторить</span>';
}

function statusOptions(selected){return Object.entries(statusLabels).map(([value,label])=>'<option value="'+value+'" '+(selected===value?'selected':'')+'>'+label+'</option>').join('')}

function filteredOrders(){
  const query=(document.getElementById('ordersSearch')?.value||'').trim().toLowerCase();
  const status=document.getElementById('ordersFilter')?.value||'';
  return orders.filter(order=>{
    if(status&&order.status!==status)return false;
    if(!query)return true;
    const haystack=[order.orderId,order.customer?.name,order.customer?.contact,order.customer?.comment,order.message,...(order.files||[]).map(file=>file.name)].join(' ').toLowerCase();
    return haystack.includes(query);
  });
}

function renderOrders(){
  const list=document.getElementById('ordersList');if(!list)return;
  const visible=filteredOrders();
  const newCount=orders.filter(order=>order.status==='new').length;
  document.getElementById('ordersBadge').textContent=newCount;
  document.getElementById('ordersBadge').hidden=!newCount;
  document.getElementById('ordersTotal').textContent=orders.length;
  document.getElementById('ordersNew').textContent=newCount;
  document.getElementById('ordersActive').textContent=orders.filter(order=>['contacted','in_progress'].includes(order.status)).length;
  if(!visible.length){list.innerHTML='<div class="orders-empty">'+(orders.length?'По выбранному фильтру заявок нет.':'Заявок пока нет.')+'</div>';return;}
  list.innerHTML=visible.map(order=>{
    const contact=esc(order.customer?.contact||'Не указан');const phone=telUrl(order.customer?.contact);
    const files=(order.files||[]).map(file=>{const url=safeUrl(file.url);return url?'<a class="order-admin-file" href="'+esc(url)+'" target="_blank" rel="noopener">Скачать '+esc(file.name)+'</a>':'<span class="order-admin-file">'+esc(file.name)+'</span>'}).join('');
    return '<article class="order-admin-card" data-order-id="'+esc(order.orderId)+'" data-status="'+esc(order.status)+'"><div class="order-admin-head"><div><div class="order-admin-id">Заявка №'+esc(order.orderId)+'</div><div class="order-admin-date">'+esc(dateLabel(order.createdAt))+'</div></div><select class="order-admin-status" aria-label="Статус заявки">'+statusOptions(order.status)+'</select></div><div class="order-admin-grid"><div class="order-admin-field"><span>Заказчик</span><b>'+esc(order.customer?.name||'Имя не указано')+'</b></div><div class="order-admin-field"><span>Телефон</span>'+(phone?'<a href="'+esc(phone)+'">'+contact+'</a>':'<b>'+contact+'</b>')+'</div><div class="order-admin-field"><span>Тип заявки</span><b>'+(order.kind==='stl'?'STL / 3MF':'MakerWorld')+'</b></div></div>'+(order.customer?.comment?'<p class="order-admin-comment">'+esc(order.customer.comment)+'</p>':'')+(files?'<div class="order-admin-files">'+files+'</div>':'')+'<details class="order-admin-message"><summary>Показать расчёт и параметры</summary><pre>'+esc(order.message||'Нет данных')+'</pre></details><div class="order-admin-footer"><div class="order-notifications">'+notificationBadge('Telegram',order.notifications?.telegram)+notificationBadge('MAX',order.notifications?.max)+'</div><button class="ghost order-retry" type="button">Повторить уведомления</button></div></article>';
  }).join('');
}

async function ordersPost(payload){
  const response=await fetch('/api/admin-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,password:sessionStorage.getItem('sitroAdminPassword')||''})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||('Ошибка сервера: HTTP '+response.status));
  return data;
}

export async function loadOrders(){
  if(!sessionStorage.getItem('sitroAdminPassword'))return;
  const status=document.getElementById('ordersStatus');if(!status)return;
  status.className='status orders-status loading';status.textContent='Загружаю заявки…';
  try{const data=await ordersPost({action:'list',limit:200});orders=Array.isArray(data.orders)?data.orders:[];ordersLoaded=true;renderOrders();status.className='status orders-status ok';status.textContent='Заявки обновлены.';setTimeout(()=>{if(status.textContent==='Заявки обновлены.')status.textContent=''},1800)}catch(error){status.className='status orders-status err';status.textContent=error.message||'Не удалось загрузить заявки.'}
}

if(adminApp&&backupTools){
  const section=document.createElement('details');section.className='categories-spoiler';section.id='ordersAdmin';section.innerHTML='<summary class="orders-summary">Заявки <span class="orders-badge" id="ordersBadge" hidden>0</span></summary><div class="categories-spoiler-body"><p class="sub">Все заявки сохраняются на Яндекс Диске и остаются здесь, даже если уведомление в мессенджер не дошло.</p><div class="orders-tools"><input id="ordersSearch" placeholder="Поиск по имени, телефону или номеру"><select id="ordersFilter"><option value="">Все статусы</option>'+statusOptions('')+'</select><button class="ghost" id="ordersRefresh" type="button">Обновить</button></div><div class="orders-stats"><div class="orders-stat"><span>Всего</span><b id="ordersTotal">0</b></div><div class="orders-stat"><span>Новые</span><b id="ordersNew">0</b></div><div class="orders-stat"><span>В работе</span><b id="ordersActive">0</b></div></div><div class="status orders-status" id="ordersStatus" role="status" aria-live="polite"></div><div class="orders-list" id="ordersList"><div class="orders-empty">Откройте раздел, чтобы загрузить заявки.</div></div></div>';
  backupTools.insertAdjacentElement('afterend',section);
  document.getElementById('ordersSearch').addEventListener('input',renderOrders);
  document.getElementById('ordersFilter').addEventListener('change',renderOrders);
  document.getElementById('ordersRefresh').addEventListener('click',loadOrders);
  section.addEventListener('toggle',()=>{if(section.open&&!ordersLoaded)loadOrders()});
  document.getElementById('ordersList').addEventListener('change',async event=>{
    const select=event.target.closest('.order-admin-status');if(!select)return;
    const card=select.closest('.order-admin-card');const previous=card.dataset.status;select.disabled=true;
    try{const data=await ordersPost({action:'status',orderId:card.dataset.orderId,status:select.value});const index=orders.findIndex(order=>order.orderId===card.dataset.orderId);if(index>=0)orders[index]=data.order;renderOrders()}catch(error){select.value=previous;const status=document.getElementById('ordersStatus');status.className='status orders-status err';status.textContent=error.message}finally{select.disabled=false}
  });
  document.getElementById('ordersList').addEventListener('click',async event=>{
    const button=event.target.closest('.order-retry');if(!button)return;
    const card=button.closest('.order-admin-card');button.disabled=true;button.textContent='Отправляю…';
    try{const data=await ordersPost({action:'retry',orderId:card.dataset.orderId});const index=orders.findIndex(order=>order.orderId===card.dataset.orderId);if(index>=0)orders[index]=data.order;renderOrders();const status=document.getElementById('ordersStatus');status.className='status orders-status ok';status.textContent='Уведомления отправлены повторно.'}catch(error){const status=document.getElementById('ordersStatus');status.className='status orders-status err';status.textContent=error.message}finally{button.disabled=false;button.textContent='Повторить уведомления'}
  });
}

window.sitroLoadOrders=loadOrders;
if(adminApp?.classList.contains('show'))loadOrders();
