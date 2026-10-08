import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const domain = 'https://ситро-3д.рф';
const image = `${domain}/design-assets/sitro-share-card.png?v=20261002`;
const logo = `${domain}/design-assets/sitro-logo.png`;
const map = 'https://yandex.ru/maps/?rtext=~52.578173,39.510493&rtt=automt';

const pages = [
  {
    file: '3d-pechat-korpusov-lipeck.html',
    title: '3D-печать корпусов на заказ в Липецке | СИТРО',
    description: 'Изготовление корпусов на 3D-принтере в Липецке: для электроники, датчиков, приборов и прототипов. От одной детали до малой серии.',
    service: '3D-печать корпусов на заказ',
    type: 'Изготовление корпусов на 3D-принтере',
    h1: '3D-печать корпусов на заказ в Липецке',
    lead: 'Изготавливаем корпуса для электроники, датчиков, приборов и небольших устройств. Работаем по готовой 3D-модели, чертежу, размерам или образцу.',
    cardsTitle: 'Какие корпуса изготавливаем',
    cards: [
      ['Корпуса для электроники', 'Корпус, крышка, стойки под плату, отверстия под разъёмы, кнопки и крепёж.'],
      ['Защитные кожухи', 'Кожухи и крышки для оборудования, мастерской, автоматики и бытовых задач.'],
      ['Прототипы корпусов', 'Проверка размеров, сборки и внешнего вида перед выпуском малой серии.']
    ],
    textTitle: 'Корпус по модели, чертежу или плате',
    paragraphs: [
      'Если у вас есть STL или 3MF, загрузите модель в калькулятор. При отсутствии файла подготовим 3D-модель по чертежу, размерам, фотографии, плате или существующему корпусу.',
      'До изготовления уточняем расположение разъёмов, способ сборки, температуру эксплуатации и нагрузку. По задаче подбираем PETG, ABS, ASA, PA или другой доступный материал.'
    ],
    faq: [
      ['Можно сделать корпус по электронной плате?', 'Да. Нужны размеры платы, расположение разъёмов, органов управления и точек крепления.'],
      ['Можно напечатать один корпус?', 'Да. Выполняем единичные заказы, прототипы и малые серии.'],
      ['Сделаете крышку и крепления?', 'Да. Конструкцию можно дополнить крышкой, стойками, защёлками, винтовыми соединениями и посадочными местами.'],
      ['Какой пластик выбрать?', 'Материал подбираем по температуре, нагрузке, условиям эксплуатации и требуемому внешнему виду.']
    ]
  },
  {
    file: 'zapchasti-na-3d-printere-lipeck.html',
    title: 'Запчасти на 3D-принтере в Липецке | СИТРО',
    description: 'Изготовление пластиковых запчастей и редких деталей на 3D-принтере в Липецке по модели, чертежу, размерам или образцу.',
    service: 'Запчасти и редкие детали на 3D-принтере',
    type: 'Изготовление пластиковых запчастей',
    h1: 'Изготовление запчастей на 3D-принтере в Липецке',
    lead: 'Восстанавливаем пластиковые детали, которые сложно найти или уже сняли с производства. Можно принести образец, обломки детали, размеры или готовую модель.',
    cardsTitle: 'Что можно восстановить',
    cards: [
      ['Крепления и держатели', 'Кронштейны, фиксаторы, защёлки, направляющие и другие элементы крепления.'],
      ['Шестерни и переходники', 'Ненагруженные и умеренно нагруженные детали с проверкой размеров и посадки.'],
      ['Детали для техники', 'Ручки, заглушки, корпуса, крышки и элементы, которых уже нет в продаже.']
    ],
    textTitle: 'Запчасть по образцу или размерам',
    paragraphs: [
      'Сначала оцениваем, подходит ли 3D-печать для конкретной нагрузки. Затем снимаем размеры или используем предоставленную модель, согласуем материал и печатаем пробный экземпляр.',
      'Для функциональных изделий учитываем направление нагрузки, температуру, контакт с влагой и точность посадки. Если печать не подходит для безопасной эксплуатации, сообщим об этом до заказа.'
    ],
    faq: [
      ['Можно сделать деталь по сломанному образцу?', 'Да. Принесите сохранившуюся деталь или её части. Для восстановления геометрии также пригодятся фотографии и размеры.'],
      ['Подойдёт ли напечатанная запчасть для высокой нагрузки?', 'Это зависит от конструкции, материала и условий работы. Сначала оценим задачу и честно сообщим об ограничениях.'],
      ['Можно изменить слабое место детали?', 'Да. При моделировании можно усилить стенку, изменить крепление или скорректировать геометрию, если это допускает узел.'],
      ['Сделаете несколько одинаковых запчастей?', 'Да. После проверки первого экземпляра можно изготовить малую серию.']
    ]
  },
  {
    file: 'prototipirovanie-lipeck.html',
    title: 'Прототипирование и 3D-печать в Липецке | СИТРО',
    description: 'Прототипирование изделий в Липецке: 3D-моделирование, тестовые образцы и печать прототипов перед производством.',
    service: 'Прототипирование изделий',
    type: '3D-прототипирование',
    h1: 'Прототипирование изделий в Липецке',
    lead: 'Помогаем проверить конструкцию, размеры и сборку до запуска производства. Создаём 3D-модель, печатаем тестовый образец и вносим согласованные изменения.',
    cardsTitle: 'Что проверяем на прототипе',
    cards: [
      ['Габариты и посадки', 'Проверяем, помещаются ли компоненты, совпадают ли отверстия и собираются ли части изделия.'],
      ['Удобство конструкции', 'Оцениваем форму, доступ к разъёмам, кнопкам, крепежу и другим рабочим элементам.'],
      ['Внешний вид', 'Печатаем демонстрационные макеты для презентации, согласования или выставки.']
    ],
    textTitle: 'От идеи до тестового образца',
    paragraphs: [
      'Для начала подойдут чертёж, эскиз, размеры, фотография, CAD-модель или физический образец. Уточним назначение изделия и выберем минимальный объём работ для проверки идеи.',
      'После печати прототип можно примерить, собрать и проверить. При необходимости корректируем модель и выпускаем следующий экземпляр или небольшую серию.'
    ],
    faq: [
      ['Обязательно иметь готовую 3D-модель?', 'Нет. Можем подготовить её по чертежу, эскизу, размерам или образцу.'],
      ['Прототип будет рабочим?', 'Это зависит от задачи. Можно изготовить макет для проверки формы или функциональный образец из подходящего пластика.'],
      ['Можно внести изменения после первой печати?', 'Да. В этом и состоит смысл прототипирования: проверить изделие и скорректировать модель до следующего этапа.'],
      ['Можно затем заказать малую серию?', 'Да. После согласования прототипа рассчитаем изготовление требуемого количества изделий.']
    ]
  },
  {
    file: 'seriynaya-3d-pechat-lipeck.html',
    title: 'Мелкосерийная 3D-печать в Липецке | СИТРО',
    description: 'Мелкосерийное изготовление изделий на 3D-принтерах в Липецке. Детали, корпуса, сувениры и оснастка небольшими партиями.',
    service: 'Мелкосерийная 3D-печать',
    type: 'Серийная 3D-печать',
    h1: 'Мелкосерийная 3D-печать в Липецке',
    lead: 'Изготавливаем небольшие партии одинаковых изделий без дорогой оснастки: корпуса, крепления, элементы оборудования, сувениры и вспомогательные детали.',
    cardsTitle: 'Когда подходит малая серия',
    cards: [
      ['Тестовая партия', 'Небольшое количество изделий для проверки спроса, сборки или эксплуатации.'],
      ['Регулярное изготовление', 'Повторяемые партии деталей по согласованной модели и параметрам печати.'],
      ['Персонализация', 'Изделия с разными надписями, номерами, цветами или небольшими изменениями конструкции.']
    ],
    textTitle: 'Производство от одной детали до партии',
    paragraphs: [
      'Перед серией печатаем и согласуем образец. После проверки фиксируем модель, материал, цвет и основные параметры, чтобы изделия одной партии были предсказуемыми.',
      'Стоимость зависит от массы, времени печати, количества, сложности подготовки и постобработки. Для предварительной оценки загрузите модель в калькулятор и укажите количество.'
    ],
    faq: [
      ['С какого количества начинается серия?', 'Жёсткого минимального тиража нет. Рассчитываем и единичные изделия, и небольшие повторяемые партии.'],
      ['Сначала можно заказать образец?', 'Да. Для новой модели это рекомендуемый порядок перед изготовлением всей партии.'],
      ['Цена за штуку уменьшается с количеством?', 'Обычно подготовительные операции распределяются на партию, но итог зависит от модели, времени печати и загрузки оборудования.'],
      ['Можно повторить заказ позже?', 'Да. Согласованную модель и параметры можно использовать для следующей партии.']
    ]
  },
  {
    file: 'suveniry-3d-pechat-lipeck.html',
    title: 'Сувениры и фигурки на 3D-принтере в Липецке | СИТРО',
    description: '3D-печать сувениров, фигурок, брелоков, магнитов и подарков в Липецке. Изготовление по готовой модели или индивидуальному дизайну.',
    service: '3D-печать сувениров и фигурок',
    type: 'Изготовление сувениров на 3D-принтере',
    h1: 'Сувениры и фигурки на 3D-принтере в Липецке',
    lead: 'Печатаем фигурки, брелоки, магниты, таблички, топперы и брендированные изделия. Можно выбрать готовую модель или заказать подготовку индивидуального дизайна.',
    cardsTitle: 'Что можно заказать',
    cards: [
      ['Фигурки и подарки', 'Персонажи, декоративные изделия и необычные подарки по готовой 3D-модели.'],
      ['Брелоки и магниты', 'Небольшие сувениры с надписью, номером, логотипом или индивидуальной формой.'],
      ['Изделия для бизнеса', 'Таблички, топперы, элементы оформления и небольшие брендированные партии.']
    ],
    textTitle: 'Сувенир по готовой модели или вашей идее',
    paragraphs: [
      'Если модель найдена на MakerWorld, вставьте ссылку в калькулятор. Также можно загрузить STL или прислать изображение и описание для оценки моделирования.',
      'До печати согласуем размер, материал, цвет, количество и необходимость сборки. Для крупной фигурки или сложного изделия стоимость подтверждаем после проверки модели.'
    ],
    faq: [
      ['Можно напечатать фигурку по фотографии?', 'Фотография подходит для предварительной оценки, но потребуется создание или подбор 3D-модели.'],
      ['Можно добавить надпись или логотип?', 'Да. Оценим изменение готовой модели или создание индивидуального макета.'],
      ['Печатаете в нескольких цветах?', 'Да, если модель и технология позволяют. Цвета и способ изготовления согласуем до запуска.'],
      ['Можно заказать несколько одинаковых сувениров?', 'Да. Изготавливаем единичные изделия и небольшие партии.']
    ]
  }
];

const links = [
  ['/3d-pechat-lipeck.html', '3D-печать на заказ'],
  ['/3d-modelirovanie.html', '3D-моделирование'],
  ['/tehnicheskie-detali.html', 'Технические детали'],
  ['/3d-pechat-korpusov-lipeck.html', 'Корпуса'],
  ['/zapchasti-na-3d-printere-lipeck.html', 'Запчасти'],
  ['/prototipirovanie-lipeck.html', 'Прототипирование'],
  ['/seriynaya-3d-pechat-lipeck.html', 'Малые серии'],
  ['/suveniry-3d-pechat-lipeck.html', 'Сувениры']
];

function esc(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function jsonLd(page, url) {
  const business = {'@type':'LocalBusiness','@id':`${domain}/#business`,name:'СИТРО — фабрика 3D-печати',alternateName:'СИТРО',description:'3D-печать и моделирование на заказ в Липецке: технические детали, корпуса, прототипы, сувениры и малые серии.',url:`${domain}/`,logo,image,telephone:'+7 905 688-44-43',email:'sitmaker@yandex.ru',priceRange:'₽₽',currenciesAccepted:'RUB',address:{'@type':'PostalAddress',streetAddress:'ул. Свиридова, 9, 2 этаж',addressLocality:'Липецк',addressRegion:'Липецкая область',postalCode:'398024',addressCountry:'RU'},geo:{'@type':'GeoCoordinates',latitude:52.578173,longitude:39.510493},areaServed:[{'@type':'City',name:'Липецк'},{'@type':'Country',name:'Россия'}],hasMap:map,sameAs:['https://t.me/sitro48','https://vk.ru/sitmaker'],contactPoint:{'@type':'ContactPoint',telephone:'+7 905 688-44-43',contactType:'customer service',areaServed:'RU',availableLanguage:'Russian'}};
  return [
    {'@context':'https://schema.org','@type':'Service','@id':`${url}#service`,name:page.service,serviceType:page.type,description:page.description,url,image,areaServed:[{'@type':'City',name:'Липецк'},{'@type':'Country',name:'Россия'}],provider:{'@id':`${domain}/#business`}},
    {'@context':'https://schema.org','@graph':[business,{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Главная',item:`${domain}/`},{'@type':'ListItem',position:2,name:page.service,item:url}]},{'@type':'FAQPage',mainEntity:page.faq.map(([name,text])=>({'@type':'Question',name,acceptedAnswer:{'@type':'Answer',text}}))}]}
  ];
}

function render(page) {
  const url = `${domain}/${page.file}`;
  const schemas = jsonLd(page,url).map(item=>`<script type="application/ld+json">${JSON.stringify(item)}</script>`).join('\n');
  const related = links.filter(([href])=>!url.endsWith(href)).map(([href,label])=>`<a href="${href}">${esc(label)}</a>`).join('');
  const cards = page.cards.map(([title,text])=>`<article class="card"><b>${esc(title)}</b><span>${esc(text)}</span></article>`).join('');
  const paragraphs = page.paragraphs.map(text=>`<p>${esc(text)}</p>`).join('');
  const faq = page.faq.map(([question,answer])=>`<details><summary>${esc(question)}</summary><p>${esc(answer)}</p></details>`).join('');
  const footer = links.map(([href,label])=>`<a href="${href}">${esc(label)}</a>`).join('');
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>${esc(page.title)}</title><meta name="description" content="${esc(page.description)}"><meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="${url}">
<meta name="geo.region" content="RU-LIP"><meta name="geo.placename" content="Липецк"><meta property="og:type" content="website"><meta property="og:locale" content="ru_RU"><meta property="og:site_name" content="СИТРО"><meta property="og:url" content="${url}"><meta property="og:title" content="${esc(page.title)}"><meta property="og:description" content="${esc(page.description)}"><meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="СИТРО — 3D-печать и моделирование в Липецке"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(page.title)}"><meta name="twitter:description" content="${esc(page.description)}"><meta name="twitter:image" content="${image}"><meta name="twitter:image:alt" content="СИТРО — 3D-печать и моделирование в Липецке">
${schemas}
<link rel="stylesheet" href="/service-page.css?v=20261008-3"><script defer src="/yandex-metrika.js?v=2"></script></head><body>
<header class="top"><div class="wrap"><a class="brand" href="/"><img src="/design-assets/sitro-logo-small.png" alt="СИТРО"></a><a class="back" href="/#services">← Все услуги</a></div></header>
<main><div class="wrap crumbs"><a href="/">Главная</a> → ${esc(page.service)}</div>
<section class="hero"><div class="wrap"><div class="hero-copy"><span class="eyebrow">СИТРО · ЛИПЕЦК</span><h1>${esc(page.h1)}</h1><p class="lead">${esc(page.lead)}</p><div class="actions"><a class="btn primary" href="/#calculator">Рассчитать стоимость</a><a class="btn" href="/#contacts">Обсудить задачу</a></div><div class="facts"><span>От одной детали</span><span>PLA · PETG · ABS · ASA · PA</span><span>Самовывоз в Липецке</span><span>Доставка по России</span></div></div></div></section>
<section class="section alt"><div class="wrap"><h2>${esc(page.cardsTitle)}</h2><p class="sub">Сначала проверим задачу, затем согласуем материал, стоимость и срок изготовления.</p><div class="grid">${cards}</div></div></section>
<section class="section"><div class="wrap content"><h2>${esc(page.textTitle)}</h2>${paragraphs}<p><a class="text-link" href="/#calculator">Рассчитать 3D-печать онлайн →</a></p></div></section>
<section class="section alt"><div class="wrap"><h2>Как оформить заказ</h2><div class="grid steps"><article class="card"><b>Пришлите задачу</b><span>STL или 3MF, ссылку MakerWorld, фотографию, чертёж, размеры или образец.</span></article><article class="card"><b>Согласуем решение</b><span>Проверим модель, материал, цвет, стоимость и срок изготовления.</span></article><article class="card"><b>Изготовим заказ</b><span>Напечатаем изделие и договоримся о самовывозе в Липецке или доставке.</span></article></div></div></section>
<section class="section"><div class="wrap content"><h2>Частые вопросы</h2><div class="faq">${faq}</div><h2 class="related-title">Другие услуги СИТРО</h2><div class="service-links">${related}</div></div></section>
<section class="section alt"><div class="wrap"><div class="cta"><div><h2>Рассчитайте заказ</h2><p>Загрузите модель и получите предварительную стоимость печати.</p></div><a class="btn primary" href="/#calculator">Перейти к калькулятору</a></div></div></section></main>
<footer><div class="wrap"><nav class="footer-links" aria-label="Услуги"><a href="/">Главная</a>${footer}<a href="/privacy.html">Конфиденциальность</a></nav>© СИТРО · 3D-печать и моделирование в Липецке</div></footer></body></html>\n`;
}

await Promise.all(pages.map(page => writeFile(join(root,page.file),render(page),'utf8')));
console.log(`Generated ${pages.length} SEO pages`);
