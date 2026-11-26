import { materials } from './demo-data.js';

const topic = new URLSearchParams(location.search).get('topic');
if (Object.hasOwn(materials, topic)) {
  const { title, page, section, excerpt, context } = materials[topic];
  document.title = `${title} · Нейро-мед`;
  document.getElementById('material-title').textContent = title;
  document.getElementById('page-number').textContent = `Страница ${page}`;
  document.getElementById('section-title').textContent = section;
  document.getElementById('excerpt').textContent = excerpt;
  document.getElementById('context').textContent = context;
  const pageContent = document.getElementById('material-page');
  pageContent.id = `page-${page}`;
  pageContent.hidden = false;
}
