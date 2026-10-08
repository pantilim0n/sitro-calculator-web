import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const domain = 'https://ситро-3д.рф';
const image = `${domain}/design-assets/sitro-share-card.png?v=20261002`;

const publicPages = [
  'index.html',
  '3d-pechat-lipeck.html',
  '3d-modelirovanie.html',
  'tehnicheskie-detali.html',
  '3d-pechat-korpusov-lipeck.html',
  'zapchasti-na-3d-printere-lipeck.html',
  'prototipirovanie-lipeck.html',
  'seriynaya-3d-pechat-lipeck.html',
  'suveniry-3d-pechat-lipeck.html'
];

const business = {
  '@type': 'LocalBusiness',
  '@id': `${domain}/#business`,
  name: 'СИТРО — фабрика 3D-печати',
  alternateName: 'СИТРО',
  description: '3D-печать и моделирование на заказ в Липецке: технические детали, корпуса, прототипы, сувениры и малые серии.',
  url: `${domain}/`,
  logo: `${domain}/design-assets/sitro-logo.png`,
  image,
  telephone: '+7 905 688-44-43',
  email: 'sitmaker@yandex.ru',
  priceRange: '₽₽',
  currenciesAccepted: 'RUB',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'ул. Свиридова, 9, 2 этаж',
    addressLocality: 'Липецк',
    addressRegion: 'Липецкая область',
    postalCode: '398024',
    addressCountry: 'RU'
  },
  geo: {'@type': 'GeoCoordinates', latitude: 52.578173, longitude: 39.510493},
  areaServed: [{'@type': 'City', name: 'Липецк'}, {'@type': 'Country', name: 'Россия'}],
  hasMap: 'https://yandex.ru/maps/?rtext=~52.578173,39.510493&rtt=automt',
  sameAs: ['https://t.me/sitro48', 'https://vk.ru/sitmaker'],
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+7 905 688-44-43',
    contactType: 'customer service',
    areaServed: 'RU',
    availableLanguage: 'Russian'
  }
};

const mainSchema = {'@context': 'https://schema.org', ...business};
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${domain}/#website`,
  url: `${domain}/`,
  name: 'СИТРО — 3D-печать и моделирование в Липецке',
  inLanguage: 'ru-RU',
  publisher: {'@id': `${domain}/#business`}
};

for (const file of publicPages) {
  const path = join(root, file);
  let html = await readFile(path, 'utf8');
  if (!/<meta name="robots"/.test(html)) {
    html = html.replace('<link rel="canonical"', '<meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical"');
  }
  if (file === 'index.html') {
    html = html.replace(
      /<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org"[\s\S]*?<\/script><script type="application\/ld\+json" id="portfolioStructuredData">/,
      `<script type="application/ld+json">${JSON.stringify(mainSchema)}</script><script type="application/ld+json">${JSON.stringify(websiteSchema)}</script><script type="application/ld+json" id="portfolioStructuredData">`
    );
  }
  await writeFile(path, html, 'utf8');
}

console.log(`Updated local SEO metadata on ${publicPages.length} public pages`);
