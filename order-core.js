const fallback=(value,label)=>String(value||'').trim()||label;

export function buildMakerOrderText({customer={},order}){
  if(!order)return '';
  return [
    'ЗАЯВКА С САЙТА СИТРО',
    'Тип расчёта: модель MakerWorld',
    '',
    'Заказчик: '+fallback(customer.name,'Не указано'),
    'Контакт для ответа: '+fallback(customer.contact,'Не указан'),
    '',
    'МОДЕЛЬ',
    'Название: '+fallback(order.model,'Без названия'),
    'Профиль печати: '+fallback(order.profile,'Не указан'),
    'Количество: '+order.quantity+' шт.',
    'Материал: '+fallback(order.material,'Не указан'),
    'Ориентировочный вес: '+Number(order.grams||0).toFixed(1)+' г',
    'Ориентировочное время печати: '+Number(order.hours||0).toFixed(2)+' ч',
    'Предварительная стоимость: '+Math.ceil(Number(order.price)||0)+' ₽',
    'Ссылка на модель: '+fallback(order.url,'Не указана'),
    'Комментарий: '+fallback(customer.comment,'Нет'),
    '',
    'Стоимость предварительная — подтвердите цену и срок перед запуском печати.'
  ].join('\n');
}

export function buildStlOrderText({customer={},items=[],groupCount=0,total=0}){
  return [
    'ЗАЯВКА С САЙТА СИТРО',
    'Тип расчёта: загруженные STL-файлы',
    '',
    'Заказчик: '+fallback(customer.name,'Не указано'),
    'Контакт для ответа: '+fallback(customer.contact,'Не указан'),
    '',
    'МОДЕЛИ',
    ...items.map((item,index)=>[
      (index+1)+'. '+fallback(item.file,'Файл без названия'),
      '   Количество: '+item.qty+' шт. · Материал: '+fallback(item.material,'Не указан')+' · Цвет: '+fallback(item.color,'Не указан'),
      '   Ориентировочный вес: '+Math.ceil(Number(item.estimatedGrams)||0)+' г'
    ].join('\n')),
    '',
    'Печатных групп: '+groupCount,
    'Предварительная стоимость: ≈ '+Math.ceil(Number(total)||0)+' ₽',
    'Комментарий: '+fallback(customer.comment,'Нет'),
    '',
    'Файлы STL нужно приложить к сообщению.',
    'Стоимость предварительная — подтвердите цену и срок после проверки моделей.'
  ].join('\n');
}

export function messengerDraftUrl(type,message){
  const encoded=encodeURIComponent(String(message||''));
  if(type==='telegram')return 'https://t.me/SITMAKER?text='+encoded;
  if(type==='max')return 'https://max.ru/u/f9LHodD0cOJGycqhJHkPaD-ymeKK6oYbrxtihzH4KBOgABKCslGcU7jGl_8';
  throw new Error('Неизвестный мессенджер');
}
