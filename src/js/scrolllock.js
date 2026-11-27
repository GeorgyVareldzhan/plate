/**
 * Keep the page still while a modal dialog is open. iOS Safari lets a swipe on a dialog or
 * its backdrop scroll the page underneath; fixing the body in place stops that. Works for
 * every dialog, including ones created on the fly (action sheets).
 */
let lockedAt = null; // page scroll position while locked

function lock() {
  lockedAt = window.scrollY;
  Object.assign(document.body.style, { position: 'fixed', top: `-${lockedAt}px`, left: '0', right: '0' });
}

function unlock() {
  Object.assign(document.body.style, { position: '', top: '', left: '', right: '' });
  window.scrollTo(0, lockedAt);
  lockedAt = null;
}

function update() {
  const open = document.querySelector('dialog[open]') !== null;
  if (open && lockedAt === null) lock();
  else if (!open && lockedAt !== null) unlock();
}

export function initScrollLock() {
  // Lock and unlock right away when code opens or closes a dialog: code often scrolls the page
  // just after closing one (to a product it added), and a later unlock would undo that
  for (const method of ['showModal', 'close']) {
    const original = HTMLDialogElement.prototype[method];
    HTMLDialogElement.prototype[method] = function patched(...args) {
      const result = original.apply(this, args);
      update();
      return result;
    };
  }
  // Everything else: Escape, dialogs removed from the page
  new MutationObserver(update).observe(document.body, {
    subtree: true,
    childList: true, // action sheets are removed from the page when closed
    attributes: true,
    attributeFilter: ['open'],
  });
}
