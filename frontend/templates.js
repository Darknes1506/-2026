import { initialTemplates } from './demo-data.js';
import { bindPopup, byId, confirmAction, dismissOnBackdrop } from './ui.js';

const storageKey = 'neuromed.demo.templates.v1';
const templateIcons = new Set(['spark', 'layers', 'list']);

function readTemplates() {
  let saved;
  try {
    saved = localStorage.getItem(storageKey);
  } catch {
    return initialTemplates();
  }
  if (saved === null) {
    const initial = initialTemplates();
    saveTemplates(initial);
    return initial;
  }
  try {
    const items = JSON.parse(saved);
    if (Array.isArray(items)) {
      return items.filter((item) => typeof item?.id === 'string'
        && typeof item.title === 'string' && typeof item.prompt === 'string');
    }
  } catch {
    // An unreadable collection stays empty until the next edit.
  }
  return [];
}

function saveTemplates(items) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    // The current tab can keep working without browser storage.
  }
}

export function initTemplates(composer, question, updateComposer) {
  let templates = readTemplates();
  let editing = null;
  let editorTrigger = null;
  const trigger = byId('help-trigger');
  const popup = byId('help-popup');
  composer.append(popup);
  const phoneLayout = matchMedia('(max-width: 540px)');
  const help = bindPopup(popup, () => ({ anchor: composer, preferAbove: phoneLayout.matches }));
  const options = byId('help-options');
  const dialog = byId('templates-dialog');
  const heading = byId('templates-heading');
  const listView = byId('template-list-view');
  const list = byId('template-list');
  const add = byId('add-template');
  const editor = byId('template-editor');
  const title = byId('template-title');
  const prompt = byId('template-prompt');

  async function applyTemplate(template) {
    help.close();
    if (question.value.trim()) {
      const accepted = await confirmAction('Заменить черновик?', `В поле уже есть текст. Подставить шаблон «${template.title}» вместо него?`, 'Заменить');
      if (!accepted) {
        question.focus({ preventScroll: true });
        return;
      }
    }
    question.value = template.prompt;
    updateComposer();
    question.focus({ preventScroll: true });
    question.setSelectionRange(question.value.length, question.value.length);
  }

  function renderLists() {
    const empty = templates.length === 0;
    byId('help-empty').hidden = !empty;
    byId('quick-create-template').hidden = !empty;
    byId('template-empty').hidden = !empty;
    options.replaceChildren(...templates.map((template) => {
      const button = byId('help-option-template').content.firstElementChild.cloneNode(true);
      button.querySelector('use').setAttribute('href', `#${templateIcons.has(template.icon) ? template.icon : 'list'}`);
      button.querySelector('strong').textContent = template.title;
      button.querySelector('small').textContent = template.prompt.replace(/\s+/g, ' ');
      button.addEventListener('click', () => applyTemplate(template));
      return button;
    }));
    list.replaceChildren(...templates.map((template, index) => {
      const row = byId('template-row-template').content.firstElementChild.cloneNode(true);
      row.querySelector('strong').textContent = template.title;
      row.querySelector('.template-summary span').textContent = template.prompt.replace(/\s+/g, ' ');
      const edit = row.querySelector('.edit-template');
      edit.setAttribute('aria-label', `Редактировать шаблон «${template.title}»`);
      edit.addEventListener('click', () => showEditor(template, edit));
      const remove = row.querySelector('.delete-template');
      remove.setAttribute('aria-label', `Удалить шаблон «${template.title}»`);
      remove.addEventListener('click', () => {
        templates = templates.filter(({ id }) => id !== template.id);
        saveTemplates(templates);
        renderLists();
        const next = list.children[Math.min(index, templates.length - 1)]?.querySelector('.delete-template');
        (next ?? add).focus();
      });
      return row;
    }));
  }

  function showList(focusTarget = add) {
    editing = null;
    heading.textContent = 'Управление шаблонами';
    editor.hidden = true;
    listView.hidden = false;
    if (dialog.open) focusTarget.focus();
  }

  function showEditor(template, invoker = add) {
    editing = template;
    editorTrigger = invoker;
    heading.textContent = template ? 'Редактирование шаблона' : 'Новый шаблон';
    listView.hidden = true;
    editor.hidden = false;
    title.value = template?.title ?? '';
    prompt.value = template?.prompt ?? '';
    title.setCustomValidity('');
    prompt.setCustomValidity('');
    title.focus();
  }

  function openManager(create = false) {
    help.close();
    showList();
    dialog.showModal();
    if (create) showEditor(null);
    else add.focus();
  }

  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    help.toggle(trigger);
  });
  byId('manage-templates').addEventListener('click', () => openManager());
  byId('quick-create-template').addEventListener('click', () => openManager(true));
  add.addEventListener('click', () => showEditor(null));
  byId('cancel-template').addEventListener('click', () => showList(editorTrigger));
  byId('close-templates').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => trigger.focus({ preventScroll: true }));
  dialog.addEventListener('cancel', (event) => {
    if (!editor.hidden) {
      event.preventDefault();
      showList(editorTrigger);
    }
  });
  for (const field of [title, prompt]) field.addEventListener('input', () => field.setCustomValidity(''));
  editor.addEventListener('submit', (event) => {
    event.preventDefault();
    const titleText = title.value.trim();
    const promptText = prompt.value.trim();
    title.setCustomValidity(titleText ? '' : 'Введите название.');
    prompt.setCustomValidity(promptText ? '' : 'Введите текст запроса.');
    if (!editor.reportValidity()) return;

    const saved = { ...editing, id: editing?.id ?? crypto.randomUUID(), title: titleText, prompt: promptText };
    if (editing) templates = templates.map((template) => template.id === saved.id ? saved : template);
    else templates.push(saved);
    saveTemplates(templates);
    renderLists();
    const index = templates.indexOf(saved);
    showList(list.children[index]?.querySelector('.edit-template') ?? add);
  });
  dismissOnBackdrop(dialog);
  renderLists();
  return help.close;
}
