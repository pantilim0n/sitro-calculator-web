import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pages = [
  ['/3d-pechat-lipeck.html', '3D-печать'],
  ['/3d-modelirovanie.html', '3D-моделирование'],
  ['/tehnicheskie-detali.html', 'Детали на заказ'],
  ['/3d-pechat-korpusov-lipeck.html', 'Корпуса'],
  ['/zapchasti-na-3d-printere-lipeck.html', 'Запчасти'],
  ['/prototipirovanie-lipeck.html', 'Прототипы'],
  ['/seriynaya-3d-pechat-lipeck.html', 'Малые серии'],
  ['/suveniry-3d-pechat-lipeck.html', 'Сувениры']
];

const indexPath = join(root, 'index.html');
let index = await readFile(indexPath, 'utf8');
if (!index.includes('/seo-hub.css')) index = index.replace('</head>', '<link rel="stylesheet" href="/seo-hub.css?v=20261008-1"></head>');
const hub = `<section class="seo-hub" aria-labelledby="popularTasksTitle"><div class="wrap"><h2 class="title" id="popularTasksTitle">Популярные задачи для 3D-печати</h2><p class="sub">Выберите нужную услугу или сразу загрузите модель в калькулятор.</p><div class="seo-hub-grid"><a class="seo-hub-card" href="/3d-pechat-korpusov-lipeck.html"><strong>Корпуса для электроники и приборов</strong><span>Подробнее →</span></a><a class="seo-hub-card" href="/zapchasti-na-3d-printere-lipeck.html"><strong>Запчасти и редкие детали</strong><span>Подробнее →</span></a><a class="seo-hub-card" href="/prototipirovanie-lipeck.html"><strong>Прототипы и тестовые образцы</strong><span>Подробнее →</span></a><a class="seo-hub-card" href="/seriynaya-3d-pechat-lipeck.html"><strong>Мелкосерийное изготовление</strong><span>Подробнее →</span></a><a class="seo-hub-card" href="/suveniry-3d-pechat-lipeck.html"><strong>Сувениры и фигурки</strong><span>Подробнее →</span></a></div></div></section>`;
if (!index.includes('id="popularTasksTitle"')) index = index.replace('<section class="portfolio" id="portfolio">', `${hub}<section class="portfolio" id="portfolio">`);
const currentFooter = '<a href="/3d-pechat-lipeck.html">3D-печать в Липецке</a>\n<a href="/3d-modelirovanie.html">3D-моделирование</a>\n<a href="/tehnicheskie-detali.html">Детали на заказ</a>';
const expandedFooter = `${currentFooter}\n<a href="/3d-pechat-korpusov-lipeck.html">Корпуса</a>\n<a href="/zapchasti-na-3d-printere-lipeck.html">Запчасти</a>\n<a href="/prototipirovanie-lipeck.html">Прототипы</a>\n<a href="/seriynaya-3d-pechat-lipeck.html">Малые серии</a>\n<a href="/suveniry-3d-pechat-lipeck.html">Сувениры</a>`;
if (!index.includes('href="/3d-pechat-korpusov-lipeck.html">Корпуса</a>\n<a href="/zapchasti')) index = index.replace(currentFooter, expandedFooter);
await writeFile(indexPath, index, 'utf8');

const allServiceLinks = pages.map(([href,label])=>`<a href="${href}">${label}</a>`).join('');
for (const file of ['3d-pechat-lipeck.html','3d-modelirovanie.html','tehnicheskie-detali.html']) {
  const path = join(root,file);
  let html = await readFile(path,'utf8');
  html = html.replace(/<div class="service-links">[\s\S]*?<\/div><\/div><\/section>/, `<h2 class="related-title">Другие услуги СИТРО</h2><div class="service-links">${allServiceLinks}</div></div></section>`);
  html = html.replace(/<nav class="footer-links" aria-label="Услуги">[\s\S]*?<\/nav>/, `<nav class="footer-links" aria-label="Услуги"><a href="/">Главная</a>${allServiceLinks}<a href="/privacy.html">Конфиденциальность</a></nav>`);
  await writeFile(path,html,'utf8');
}

const sitemapPath = join(root,'sitemap.xml');
let sitemap = await readFile(sitemapPath,'utf8');
for (const [href] of pages.slice(3)) {
  const loc = `https://ситро-3д.рф${href}`;
  if (!sitemap.includes(`<loc>${loc}</loc>`)) sitemap = sitemap.replace('</urlset>', `  <url>\n    <loc>${loc}</loc>\n    <lastmod>2026-10-08</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n</urlset>`);
}
await writeFile(sitemapPath,sitemap,'utf8');

const cssPath = join(root,'service-page.css');
let css = await readFile(cssPath,'utf8');
if (!css.includes('.related-title{')) css += '\n.related-title{margin-top:42px!important}\n';
await writeFile(cssPath,css,'utf8');

console.log('Updated index, service links, sitemap and CSS');
