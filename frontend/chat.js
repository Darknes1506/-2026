import { demoReply, initialChats, materials, materialUrl } from './demo-data.js';
import { initTemplates } from './templates.js';
import { bindPopup, byId, confirmAction, dismissOnBackdrop } from './ui.js';

const composer = byId('composer');
const question = byId('question');
const send = composer.querySelector('.send');
const historyList = byId('history-list');
const historyDrawer = byId('history-drawer');
const sidebarSlot = document.querySelector('.sidebar-slot');
const sidebar = sidebarSlot.querySelector('.sidebar');
const messageList = byId('message-list');
const messageScroll = byId('message-scroll');
const sourceDialog = byId('source');
const chatPopup = byId('chat-popup');
const historyActions = bindPopup(chatPopup, () => ({ alignEnd: true }));
const mobileLayout = matchMedia('(max-width: 900px)');
const storageKey = 'neuromed.demo.chats.v1';
const pendingReplies = new Map();
const demoReplyDelay = 950;

let storageAvailable = true;
let chats = readStoredChats() ?? initialChats();
let activeChatId = null;
let activeCitation = null;
let historyActionTarget = null;
let editingMessage = false;

function readStoredChats() {
  if (!storageAvailable) return null;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(stored) && stored.every(isChat)) return stored;
  } catch {
    // The demo still works if browser storage is unavailable.
  }
  return null;
}

function isChat(chat) {
  return typeof chat?.id === 'string' && typeof chat.title === 'string'
    && Array.isArray(chat.messages) && chat.messages.every((message) => {
      if (message?.role === 'user') return typeof message.text === 'string';
      return message?.role === 'assistant' && Array.isArray(message.paragraphs)
        && message.paragraphs.every((paragraph) => typeof paragraph === 'string');
    });
}

function saveChats() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(chats));
  } catch {
    storageAvailable = false;
  }
}

function refreshChats() {
  chats = readStoredChats() ?? chats;
}

function renderHistory() {
  if (historyList.contains(chatPopup)) {
    historyActions.close();
    document.body.append(chatPopup);
  }
  const rows = chats.map((chat) => {
    const row = byId('history-template').content.firstElementChild.cloneNode(true);
    const button = row.querySelector('.history-item');
    button.querySelector('span').textContent = chat.title;
    button.title = chat.title;
    if (chat.id === activeChatId) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => selectChat(chat.id));
    const more = row.querySelector('.history-more');
    more.setAttribute('aria-label', `Действия чата «${chat.title}»`);
    more.addEventListener('click', (event) => {
      event.preventDefault();
      if (chatPopup.parentElement !== row) {
        historyActions.close();
        row.append(chatPopup);
      }
      historyActionTarget = { chat, more };
      historyActions.toggle(more);
    });
    return row;
  });
  historyList.replaceChildren(...rows);
  byId('history-empty').hidden = rows.length !== 0;
}

function renderMessage(message) {
  if (message.role === 'user') {
    const wrapper = byId('user-message-template').content.firstElementChild.cloneNode(true);
    if (message.id) wrapper.dataset.messageId = message.id;
    wrapper.querySelector('.user-message').append(message.text);
    wrapper.querySelector('.edit-message').addEventListener('click', () => beginEdit(wrapper, message));
    return wrapper;
  }

  const article = byId('assistant-template').content.firstElementChild.cloneNode(true);
  const content = article.querySelector('.assistant-content');
  for (const paragraph of message.paragraphs) {
    const text = document.createElement('p');
    text.textContent = paragraph;
    content.append(text);
  }
  if (Object.hasOwn(materials, message.source)) {
    const material = materials[message.source];
    const link = byId('citation-template').content.firstElementChild.cloneNode(true);
    link.href = materialUrl(message.source);
    link.querySelector('span').textContent = `${material.title}, с. ${material.page}`;
    link.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openSource(message.source, link);
    });
    content.append(link);
  }
  return article;
}

function renderScreen() {
  const chat = chats.find(({ id }) => id === activeChatId);
  const inChat = Boolean(chat);
  byId('chat-title').textContent = chat?.title ?? 'Учебный ассистент';
  byId('topbar-brand').hidden = inChat;
  byId('welcome').hidden = inChat;
  byId('conversation').hidden = !inChat;
  const composerSlot = byId(inChat ? 'conversation-composer' : 'welcome-composer');
  if (composer.parentElement !== composerSlot) composerSlot.append(composer);
  question.placeholder = inChat ? 'Уточните вопрос…' : 'Спросите о теме занятия…';
  byId('question-label').textContent = inChat ? 'Уточнение к вопросу' : 'Вопрос по гигиене';
  question.value = '';
  updateComposer();
  renderHistory();
}

function selectChat(chatId) {
  editingMessage = false;
  closeTemplateHelp();
  const fromDrawer = historyDrawer.open;
  if (fromDrawer) historyDrawer.close();
  if (sourceDialog.open) sourceDialog.close();
  refreshChats();
  const chat = chats.find(({ id }) => id === chatId);
  activeChatId = chat?.id ?? null;
  messageList.replaceChildren(...(chat?.messages ?? []).map(renderMessage));
  renderPendingReply();
  renderScreen();
  messageScroll.scrollTop = messageScroll.scrollHeight;
  if (!chat) question.focus({ preventScroll: true });
  else if (fromDrawer) byId('open-history').focus();
  else historyList.querySelector('[aria-current]')?.focus();
}

function updateComposer() {
  send.disabled = !question.value.trim() || pendingReplies.has(activeChatId) || editingMessage;
  for (const button of messageList.querySelectorAll('.edit-message')) {
    button.disabled = pendingReplies.has(activeChatId) || editingMessage;
  }
  question.style.height = 'auto';
  question.style.height = `${question.scrollHeight}px`;
}

function submitQuestion(event) {
  event.preventDefault();
  const text = question.value.trim();
  if (!text || pendingReplies.has(activeChatId) || editingMessage) return;

  closeTemplateHelp();
  if (sourceDialog.open) sourceDialog.close();
  refreshChats();
  let chat = chats.find(({ id }) => id === activeChatId);
  if (activeChatId && !chat) {
    selectChat(null);
    question.value = text;
    updateComposer();
    return;
  }
  if (!chat) {
    const title = text.replace(/\s+/g, ' ');
    chat = {
      id: crypto.randomUUID(),
      title: title.length <= 64 ? title : `${title.slice(0, 63).trimEnd()}…`,
      messages: [],
    };
  }
  activeChatId = chat.id;
  const history = chat.messages.slice();
  const userMessage = { id: crypto.randomUUID(), role: 'user', text };
  chat.messages.push(userMessage);
  chats = [chat, ...chats.filter((item) => item !== chat)];
  saveChats();
  const timer = setTimeout(() => finishReply(chat.id, userMessage, history), demoReplyDelay);
  pendingReplies.set(chat.id, timer);
  renderScreen();
  messageList.append(renderMessage(userMessage));
  renderPendingReply();
  updateComposer();
  question.focus({ preventScroll: true });
  messageScroll.scrollTop = messageScroll.scrollHeight;
}

function beginEdit(wrapper, message) {
  if (editingMessage || pendingReplies.has(activeChatId)) return;
  refreshChats();
  const chatId = activeChatId;
  const chat = chats.find((item) => item.id === chatId);
  if (!chat) return;
  // The transcript and the saved history both have one entry per message, including old messages without an ID.
  const index = [...messageList.children].indexOf(wrapper);
  if (index < 0 || JSON.stringify(chat.messages[index]) !== JSON.stringify(message)) return;
  const snapshot = JSON.stringify(chat.messages);
  editingMessage = true;
  updateComposer();

  const form = byId('message-editor-template').content.firstElementChild.cloneNode(true);
  const field = form.querySelector('textarea');
  const error = form.querySelector('.edit-error');
  const cancel = form.querySelector('.cancel-edit');
  const submit = form.querySelector('[type="submit"]');
  field.value = message.text;
  const original = field.value.trim();
  const history = chat.messages.slice(0, index);
  const hasLaterQuestion = chat.messages.slice(index + 1).some(({ role }) => role === 'user');
  let sending = false;

  function setSending(value) {
    sending = value;
    field.readOnly = value;
    cancel.disabled = value;
    submit.disabled = value || !field.value.trim() || field.value.trim() === original;
  }

  wrapper.replaceChildren(form);
  field.focus();
  field.setSelectionRange(field.value.length, field.value.length);
  field.addEventListener('input', () => {
    error.textContent = '';
    submit.disabled = sending || !field.value.trim() || field.value.trim() === original;
  });
  cancel.addEventListener('click', () => {
    editingMessage = false;
    const restored = renderMessage(message);
    wrapper.replaceWith(restored);
    updateComposer();
    restored.querySelector('.edit-message').focus();
  });
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.isComposing && !sending) {
      event.preventDefault();
      cancel.click();
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = field.value.trim();
    if (sending || !text || text === original) return;
    setSending(true);
    error.textContent = '';
    if (hasLaterQuestion) {
      const confirmed = await confirmAction('Продолжить с этого сообщения?', 'Последующие сообщения и ответы будут заменены новым продолжением чата.', 'Продолжить');
      if (!form.isConnected) return;
      if (!confirmed) {
        setSending(false);
        field.focus();
        return;
      }
    }
    submit.textContent = 'Отправляем…';
    await new Promise((resolve) => setTimeout(resolve, demoReplyDelay));
    if (!form.isConnected) return;

    const edited = { ...message, text };
    let reply;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      const currentChats = stored === null ? initialChats() : stored;
      const current = currentChats.find((item) => item.id === chatId);
      if (!current || JSON.stringify(current.messages) !== snapshot) {
        error.textContent = 'Диалог изменился в другой вкладке. Скопируйте правку и откройте диалог заново.';
        return;
      }
      reply = demoReply(text, history);
      const updated = { ...current, messages: [...history, edited, reply] };
      const nextChats = currentChats.map((item) => item.id === chatId ? updated : item);
      localStorage.setItem(storageKey, JSON.stringify(nextChats));
      chats = nextChats;
      storageAvailable = true;
    } catch {
      error.textContent = 'Не удалось отправить сообщение. Повторите попытку.';
      return;
    } finally {
      if (error.textContent) {
        submit.textContent = 'Отправить';
        setSending(false);
        field.focus();
      }
    }
    const oldContinuation = [...messageList.children].slice(index + 1);
    if (sourceDialog.open && oldContinuation.some((node) => node.contains(activeCitation))) sourceDialog.close();
    oldContinuation.forEach((node) => node.remove());
    const replacement = renderMessage(edited);
    wrapper.replaceWith(replacement, renderMessage(reply));
    editingMessage = false;
    updateComposer();
    renderHistory();
    replacement.querySelector('.edit-message').focus();
  });
}

function renderPendingReply() {
  messageList.querySelector('.pending-reply')?.remove();
  if (!pendingReplies.has(activeChatId)) return;
  const status = document.createElement('p');
  status.className = 'pending-reply';
  status.textContent = 'Готовим демо-ответ…';
  messageList.append(status);
}

function finishReply(chatId, userMessage, history) {
  if (!pendingReplies.delete(chatId)) return;
  refreshChats();
  const chat = chats.find(({ id }) => id === chatId);
  const index = chat?.messages.findIndex(({ id, text }) => id === userMessage.id && text === userMessage.text) ?? -1;
  if (index < 0 || chat.messages[index + 1]?.role === 'assistant') {
    if (activeChatId === chatId) selectChat(chat?.id ?? null);
    else renderHistory();
    return;
  }
  const reply = demoReply(userMessage.text, history);
  chat.messages.splice(index + 1, 0, reply);
  saveChats();
  if (activeChatId === chatId) {
    const nearBottom = messageScroll.scrollHeight - messageScroll.scrollTop - messageScroll.clientHeight < 80;
    renderPendingReply();
    const bubble = messageList.querySelector(`[data-message-id="${CSS.escape(userMessage.id)}"]`);
    if (bubble) bubble.after(renderMessage(reply));
    else messageList.append(renderMessage(reply));
    updateComposer();
    if (nearBottom) messageScroll.scrollTop = messageScroll.scrollHeight;
  }
}

async function deleteSelectedChat() {
  if (!historyActionTarget) return;
  const { chat, more } = historyActionTarget;
  historyActionTarget = null;
  historyActions.close();
  const accepted = await confirmAction('Удалить чат?', `Диалог «${chat.title}» и все его сообщения будут удалены.`, 'Удалить чат', true);
  if (!accepted) {
    more.focus({ preventScroll: true });
    return;
  }
  refreshChats();
  const index = chats.findIndex(({ id }) => id === chat.id);
  clearTimeout(pendingReplies.get(chat.id));
  pendingReplies.delete(chat.id);
  if (index >= 0) {
    chats.splice(index, 1);
    saveChats();
  }
  if (chat.id === activeChatId) selectChat(null);
  else {
    renderHistory();
    const next = historyList.children[Math.min(index, chats.length - 1)]?.querySelector('.history-more');
    (next ?? byId('new-chat')).focus({ preventScroll: true });
  }
}

function openSource(id, citation) {
  if (activeCitation && activeCitation !== citation) activeCitation.removeAttribute('aria-current');
  activeCitation = citation;
  activeCitation.setAttribute('aria-current', 'true');
  const material = materials[id];
  byId('source-title').textContent = material.title;
  byId('source-page').textContent = `Страница ${material.page}`;
  byId('source-excerpt').textContent = `«${material.excerpt}»`;
  byId('open-page').href = materialUrl(id);
  if (!sourceDialog.open) showSourceDialog();
  byId('close-source').focus({ preventScroll: true });
}

function showSourceDialog() {
  if (mobileLayout.matches) sourceDialog.showModal();
  else sourceDialog.show();
}

function syncLayout() {
  historyActions.close();
  if (mobileLayout.matches) historyDrawer.append(sidebar);
  else {
    if (historyDrawer.open) historyDrawer.close();
    sidebarSlot.append(sidebar);
  }
  if (sourceDialog.open) {
    sourceDialog.close();
    showSourceDialog();
  }
}

const closeTemplateHelp = initTemplates(composer, question, updateComposer);
composer.addEventListener('submit', submitQuestion);
question.addEventListener('input', updateComposer);
question.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!send.disabled) composer.requestSubmit();
  }
});
byId('new-chat').addEventListener('click', () => selectChat(null));
byId('mobile-new-chat').addEventListener('click', () => selectChat(null));
byId('delete-chat').addEventListener('click', deleteSelectedChat);
byId('open-history').addEventListener('click', () => {
  closeTemplateHelp();
  historyDrawer.showModal();
  byId('close-history').focus();
});
byId('close-history').addEventListener('click', () => historyDrawer.close());
byId('close-source').addEventListener('click', () => sourceDialog.close());
sourceDialog.addEventListener('close', () => {
  if (sourceDialog.open || !activeCitation) return;
  activeCitation.removeAttribute('aria-current');
  activeCitation = null;
});
sourceDialog.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !sourceDialog.matches(':modal')) sourceDialog.close();
});
dismissOnBackdrop(sourceDialog);
dismissOnBackdrop(historyDrawer);
dismissOnBackdrop(byId('confirm-dialog'));
mobileLayout.addEventListener('change', syncLayout);
syncLayout();
renderScreen();
