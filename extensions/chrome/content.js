// Content script — observes click and form-submit events on the page and
// forwards them to the background service worker. The service worker decides
// whether the page is opted-in and posts to the local Vopro agent.
//
// We avoid capturing input values entirely; only the *shape* of the action
// (kind + selector + page URL) is reported. The agent does an additional
// regex pass before anything leaves the device.

(function () {
  if (window.__voproInjected) return;
  window.__voproInjected = true;

  function safeSelector(el) {
    if (!(el instanceof Element)) return undefined;
    if (el.id) return `#${el.id}`;
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    const type = el.getAttribute('type');
    const aria = el.getAttribute('aria-label');
    const parts = [tag];
    if (role) parts.push(`[role=${role}]`);
    if (type) parts.push(`[type=${type}]`);
    if (aria) parts.push(`[aria-label="${aria.slice(0, 40)}"]`);
    return parts.join('');
  }

  function send(payload) {
    try {
      chrome.runtime.sendMessage({ type: 'vopro:event', payload });
    } catch {
      // Service worker may be inactive; the next event will revive it.
    }
  }

  document.addEventListener(
    'click',
    (e) => {
      const target = e.target instanceof Element ? e.target.closest('a,button,[role=button],[role=menuitem],input[type=submit]') : null;
      if (!target) return;
      const label =
        target.getAttribute('aria-label') ||
        target.getAttribute('title') ||
        (target.textContent || '').trim().slice(0, 80);
      send({
        kind: 'click',
        url: location.href,
        target: label || safeSelector(target),
      });
    },
    { capture: true, passive: true },
  );

  document.addEventListener(
    'submit',
    (e) => {
      const form = e.target instanceof HTMLFormElement ? e.target : null;
      if (!form) return;
      send({
        kind: 'form_submit',
        url: location.href,
        target:
          form.getAttribute('aria-label') ||
          form.getAttribute('name') ||
          safeSelector(form),
      });
    },
    { capture: true },
  );

  // Coarse focus events on text inputs / textareas — useful for sequence
  // detection without ever reading the value.
  document.addEventListener(
    'focusin',
    (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const tag = t.tagName.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea' && t.getAttribute('contenteditable') !== 'true') return;
      send({
        kind: 'focus',
        url: location.href,
        target: safeSelector(t),
      });
    },
    { capture: true, passive: true },
  );
})();
