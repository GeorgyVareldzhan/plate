/**
 * iOS-style pull down to close a sheet (dialog.sheet). Starts when the sheet is scrolled to the top:
 * the sheet follows the finger and closes when released past a quarter of its height or flicked down.
 *
 * A sheet may define dialog.beforeSwipeClose() → false to stay open (e.g. unsaved changes not discarded).
 * Touch events are used, not pointer events: only a cancelled touchmove keeps iOS from bouncing the sheet.
 */
const SLOP = 8; // px before the gesture starts
const COMMIT = 1 / 4; // share of the height past which releasing closes
const FLICK = 0.5; // px/ms — a fast flick closes regardless of the distance
const DURATION = 250; // ms
const EASE = 'cubic-bezier(.2, .8, .2, 1)';

export function initSheetSwipe() {
  let g = null;

  const place = (dialog, y, animate) => {
    dialog.style.transition = animate ? `translate ${DURATION}ms ${EASE}` : 'none';
    dialog.style.translate = y ? `0 ${y}px` : '';
    dialog.style.setProperty('--sheet-drag', String(Math.min(1, y / dialog.offsetHeight)));
  };
  const settle = (dialog, y) => new Promise((resolve) => {
    place(dialog, y, true);
    setTimeout(resolve, DURATION + 20);
  });
  const reset = (dialog) => {
    dialog.style.transition = '';
    dialog.style.translate = '';
    dialog.style.removeProperty('--sheet-drag');
  };

  addEventListener('touchstart', (e) => {
    if (g || e.touches.length !== 1) return;
    const dialog = e.target.closest?.('dialog.sheet[open]');
    if (!dialog || dialog.scrollTop > 0) return;
    const { clientX, clientY } = e.touches[0];
    g = { dialog, startX: clientX, startY: clientY, active: false, y: 0, velocity: 0, t: e.timeStamp };
  }, { passive: true });

  addEventListener('touchmove', (e) => {
    if (!g || g.finishing) return;
    const { clientX, clientY } = e.touches[0];
    const mx = clientX - g.startX;
    const my = clientY - g.startY;
    if (!g.active) {
      // Pulling up or sideways, or the sheet has scrolled meanwhile: not ours
      if (my < 0 || Math.abs(mx) > Math.abs(my) || g.dialog.scrollTop > 0) { g = null; return; }
      e.preventDefault(); // claim the touch before iOS starts its bounce
      if (my < SLOP) return;
      g.active = true;
      document.activeElement?.blur?.();
    }
    e.preventDefault();
    const y = Math.max(0, my);
    const dt = e.timeStamp - g.t;
    if (dt > 0) g.velocity = (y - g.y) / dt;
    g.y = y;
    g.t = e.timeStamp;
    place(g.dialog, y, false);
  }, { passive: false });

  const end = async () => {
    if (!g || g.finishing) return;
    if (!g.active) { g = null; return; }
    g.finishing = true;
    const { dialog } = g;
    const close = g.y > dialog.offsetHeight * COMMIT || (g.velocity > FLICK && g.y > SLOP);
    if (close && dialog.beforeSwipeClose?.() !== false) {
      await settle(dialog, dialog.offsetHeight + 40);
      dialog.close();
    } else {
      await settle(dialog, 0);
    }
    reset(dialog);
    g = null;
  };
  addEventListener('touchend', end);
  addEventListener('touchcancel', end);
}
