export const byId = (id) => document.getElementById(id);

export function bindPopup(popup, placement) {
  let trigger;

  function position() {
    if (!popup.matches(':popover-open')) return;
    const { anchor = trigger, preferAbove = false, alignEnd = false } = placement(trigger);
    const box = anchor.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const right = left + (viewport?.width ?? window.innerWidth);
    const bottom = top + (viewport?.height ?? window.innerHeight);
    const gap = 8;
    const above = Math.max(0, box.top - top - gap * 2);
    const below = Math.max(0, bottom - box.bottom - gap * 2);
    const height = popup.scrollHeight + 2;
    const preferred = preferAbove ? above : below;
    const alternative = preferAbove ? below : above;
    const usePreferred = preferred >= height || preferred >= alternative;
    const opensAbove = usePreferred ? preferAbove : !preferAbove;
    popup.style.maxHeight = `${Math.min(opensAbove ? above : below, bottom - top - gap * 2)}px`;
    const x = alignEnd ? box.right - popup.offsetWidth : trigger.getBoundingClientRect().left;
    popup.style.left = `${Math.max(left + gap, Math.min(x, right - gap - popup.offsetWidth))}px`;
    popup.style.top = `${opensAbove ? box.top - gap - popup.offsetHeight : box.bottom + gap}px`;
  }

  popup.addEventListener('beforetoggle', (event) => {
    trigger?.setAttribute('aria-expanded', String(event.newState === 'open'));
  });
  popup.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      popup.hidePopover();
      trigger.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [...popup.querySelectorAll('button:not([disabled]):not([hidden])')];
    if (!items.length) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement);
    if (event.key === 'Home') items[0].focus();
    else if (event.key === 'End') items.at(-1).focus();
    else {
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length].focus();
    }
  });
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
  window.visualViewport?.addEventListener('resize', position);

  return {
    toggle(opener) {
      if (popup.matches(':popover-open')) {
        popup.hidePopover();
        if (trigger === opener) return;
      }
      trigger = opener;
      popup.showPopover({ source: opener });
      position();
      popup.querySelector('button:not([hidden])')?.focus({ preventScroll: true });
    },
    close() { popup.hidePopover(); },
  };
}

export function confirmAction(title, description, label, destructive = false) {
  const dialog = byId('confirm-dialog');
  const accept = byId('confirm-accept');
  byId('confirm-heading').textContent = title;
  byId('confirm-copy').textContent = description;
  accept.textContent = label;
  accept.classList.toggle('danger-button', destructive);
  dialog.returnValue = 'cancel';
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    dialog.showModal();
  });
}

export function dismissOnBackdrop(dialog) {
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog || !dialog.matches(':modal')) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX >= box.right
      || event.clientY < box.top || event.clientY >= box.bottom) dialog.close();
  });
}
