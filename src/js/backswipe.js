/**
 * iOS-style swipe back: on a pushed screen (a day, a dish) a swipe from the left edge drags the
 * screen to the right, revealing the parent screen underneath. Released past a third of the width
 * (or flicked) it goes back, otherwise it slides into place.
 *
 * The parent screen underneath is a static copy of its last render (the tab screens stay alive
 * in a KeepAlive and register their root element in screenEls); the real one is shown once the
 * gesture completes, so the swap is seamless.
 */
import { h } from './dom.js';

/** Root elements of the parent screens by route name, kept up to date by the screens themselves */
export const screenEls = {};

const EDGE = 24; // px from the left edge where the gesture may start
const SLOP = 8; // px before deciding the direction
const COMMIT = 1 / 3; // share of the width past which releasing goes back
const FLICK = 0.4; // px/ms — a fast flick goes back regardless of the distance
const PARALLAX = 0.3; // the parent screen starts shifted left by this share of the width
const DURATION = 250; // ms
const EASE = 'cubic-bezier(.2, .8, .2, 1)';

/**
 * screens: { [route name]: { parent: route name, back: async () => {} } };
 * current() — name of the current route
 */
export function initBackSwipe(screens, { current }) {
  let g = null; // current gesture

  // The screen and the day totals bar (outside the screen, fixed at the bottom) move together
  const moving = () => [document.querySelector('main.app'), document.querySelector('#day-totals')].filter(Boolean);
  const layers = () => [...moving(), g.under];
  const place = (x, animate) => {
    const width = innerWidth;
    for (const el of layers()) el.style.transition = animate ? `translate ${DURATION}ms ${EASE}` : 'none';
    for (const el of moving()) el.style.translate = `${x}px 0`;
    g.under.style.translate = `${-(width - x) * PARALLAX}px 0`;
  };

  /** Put a copy of the parent screen (and its tab bar) under the current one */
  function begin() {
    document.activeElement?.blur?.();
    const source = screenEls[g.screen.parent];
    const view = source ? source.cloneNode(true) : h('section');
    const tabbar = document.querySelector('.tabbar').cloneNode(true);
    for (const b of tabbar.querySelectorAll('button')) {
      if (b.dataset.tab === g.screen.parent) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    g.under = h('div', { class: 'app back-under', 'aria-hidden': 'true', inert: '' }, view, tabbar);
    document.body.append(g.under);
    document.body.classList.add('is-back-swiping');
  }

  function cleanup() {
    for (const el of layers()) {
      el.style.transition = '';
      el.style.translate = '';
    }
    g.under.remove();
    document.body.classList.remove('is-back-swiping');
    g = null;
  }

  const settle = (x) => new Promise((resolve) => {
    place(x, true);
    setTimeout(resolve, DURATION + 20);
  });

  async function release(cancelled) {
    const width = innerWidth;
    const goBack = !cancelled && (g.x > width * COMMIT || (g.velocity > FLICK && g.x > SLOP));
    g.finishing = true;
    if (goBack) {
      await settle(width);
      await g.screen.back();
    } else {
      await settle(0);
    }
    cleanup();
  }

  // Touch events, not pointer events: on iOS only a cancelled touchmove keeps Safari from taking
  // the touch over (pointer events then just stop arriving mid-gesture)
  addEventListener('touchstart', (e) => {
    if (g || e.touches.length !== 1) return;
    const { clientX, clientY } = e.touches[0];
    if (clientX > EDGE) return;
    const screen = screens[current()];
    if (!screen || document.querySelector('dialog[open]')) return;
    g = { screen, startX: clientX, startY: clientY, active: false, x: 0, velocity: 0, t: e.timeStamp };
  }, { capture: true, passive: true });

  addEventListener('touchmove', (e) => {
    if (!g || g.finishing) return;
    if (e.touches.length !== 1) { if (!g.active) g = null; return; }
    const { clientX, clientY } = e.touches[0];
    const mx = clientX - g.startX;
    const my = clientY - g.startY;
    if (!g.active) {
      if (Math.abs(my) > Math.abs(mx) || mx < 0) { g = null; return; } // a scroll, not ours
      e.preventDefault(); // claim the touch before Safari does
      if (mx < SLOP) return;
      g.active = true;
      begin();
    }
    e.preventDefault();
    const x = Math.max(0, mx);
    const dt = e.timeStamp - g.t;
    if (dt > 0) g.velocity = (x - g.x) / dt;
    g.x = x;
    g.t = e.timeStamp;
    place(x, false);
  }, { capture: true, passive: false });

  const end = (e) => {
    if (!g || g.finishing) return;
    if (!g.active) { g = null; return; }
    // Lifting the finger after a swipe is not a tap on whatever is under it
    if (e.cancelable) e.preventDefault();
    const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => removeEventListener('click', swallow, { capture: true }), 300);
    release(e.type === 'touchcancel');
  };
  addEventListener('touchend', end, true);
  addEventListener('touchcancel', end, true);
}
