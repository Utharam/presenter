(function () {
  'use strict';

  // Sandboxed frames have an opaque origin, so touching localStorage throws.
  // Many self-contained decks persist notes or edit state there and abort
  // their whole presentation constructor when the access fails. Give them a
  // per-frame in-memory storage instead; it is disposable, like the app's own
  // session notes, and never leaves the sandbox.
  function memoryStorage() {
    var data = Object.create(null);
    return {
      getItem: function (key) {
        var k = String(key);
        return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
      },
      setItem: function (key, value) {
        data[String(key)] = String(value);
      },
      removeItem: function (key) {
        delete data[String(key)];
      },
      clear: function () {
        data = Object.create(null);
      },
      key: function (i) {
        var keys = Object.keys(data);
        return i >= 0 && i < keys.length ? keys[i] : null;
      },
      get length() {
        return Object.keys(data).length;
      },
    };
  }

  function shimStorage(name) {
    try {
      window[name].getItem('probe');
    } catch (error) {
      try {
        Object.defineProperty(window, name, { configurable: true, value: memoryStorage() });
      } catch (ignored) {
        // If the browser refuses the shadow, the deck still gets the slides
        // fallback; nothing else here can help it.
      }
    }
  }

  shimStorage('localStorage');
  shimStorage('sessionStorage');

  var strategy = 'single';
  var els = [];
  var total = 1;
  var index = 0;
  var discovered = false;
  var slideEls = [];
  var sectionEls = [];

  function apiDeck() {
    var p = window.presentation;
    return p && typeof p.showSlide === 'function' ? p : null;
  }

  function apiTotal(p) {
    if (slideEls.length > 1) return slideEls.length;
    if (sectionEls.length > 1) return sectionEls.length;
    if (p && Number.isFinite(p.totalSlides)) return p.totalSlides;
    if (p && Array.isArray(p.slides) && p.slides.length > 0) return p.slides.length;
    return 1;
  }

  function discover() {
    slideEls = Array.prototype.slice.call(document.querySelectorAll('.slide'));
    sectionEls = Array.prototype.slice.call(document.querySelectorAll('section'));
    var p = apiDeck();
    if (p) {
      strategy = 'api';
      els = slideEls.length > 1 ? slideEls : sectionEls;
      total = Math.max(1, apiTotal(p));
    } else if (slideEls.length > 1) {
      strategy = 'slides';
      els = slideEls;
      total = slideEls.length;
    } else if (sectionEls.length > 1) {
      strategy = 'sections';
      els = sectionEls;
      total = sectionEls.length;
    } else {
      strategy = 'single';
      els = [];
      total = 1;
    }
    discovered = true;
  }

  function ensureDiscovered() {
    if (!discovered) discover();
  }

  function post(msg) {
    window.parent.postMessage(msg, '*');
  }

  function postState() {
    post({ type: 'presenter:state', index: index, total: total });
  }

  function apply() {
    var p = apiDeck();
    if (p) {
      if (strategy !== 'api') {
        strategy = 'api';
        total = Math.max(1, apiTotal(p));
        if (!els.length) els = slideEls.length > 1 ? slideEls : sectionEls;
      }
      p.showSlide(index);
      return;
    }
    if (strategy === 'slides' || strategy === 'sections') {
      els.forEach(function (el, i) {
        el.classList.toggle('active', i === index);
        el.classList.toggle('visible', i === index);
      });
    }
  }

  function goTo(i) {
    ensureDiscovered();
    if (strategy === 'single') return;
    var next = Math.max(0, Math.min(total - 1, i));
    if (next === index) {
      var p = apiDeck();
      if (p && Number.isFinite(p.currentSlide) && p.currentSlide !== index) apply();
      return;
    }
    index = next;
    apply();
    postState();
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.type !== 'presenter:cmd') return;
    ensureDiscovered();
    switch (d.cmd) {
      case 'next': goTo(index + 1); break;
      case 'prev': goTo(index - 1); break;
      case 'first': goTo(0); break;
      case 'last': goTo(total - 1); break;
      case 'goto': if (Number.isInteger(d.index)) goTo(d.index); break;
    }
  });

  function isEditable(el) {
    return !!el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName));
  }

  window.addEventListener(
    'keydown',
    function (e) {
      ensureDiscovered();
      if (isEditable(e.target)) return;
      var plain = !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;

      // Read-only: a deck's own handlers never get these. Shift is allowed so
      // both `e` and Shift+E ("E") are swallowed.
      if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        post({ type: 'presenter:exit' });
        return;
      }
      if (plain && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        post({ type: 'presenter:note-toggle' });
        return;
      }
      if (plain && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        post({ type: 'presenter:fullscreen' });
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        e.stopImmediatePropagation();
        post({ type: 'presenter:shortcuts' });
        return;
      }

      // Navigation keys pass through as-is for plain documents.
      if (strategy === 'single') return;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          e.stopImmediatePropagation();
          goTo(index + 1);
          return;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          e.stopImmediatePropagation();
          goTo(index - 1);
          return;
        case 'Home':
          e.preventDefault();
          e.stopImmediatePropagation();
          goTo(0);
          return;
        case 'End':
          e.preventDefault();
          e.stopImmediatePropagation();
          goTo(total - 1);
          return;
      }
    },
    true
  );

  function findAnchor(e) {
    // composedPath() reaches anchors inside shadow roots; event.target is
    // retargeted to the shadow host, where closest('a[href]') finds nothing.
    var path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    for (var i = 0; i < path.length; i++) {
      var node = path[i];
      if (node && node.tagName === 'A' && node.hasAttribute('href')) return node;
    }
    var t = e.target;
    return t && t.closest ? t.closest('a[href]') : null;
  }

  document.addEventListener(
    'click',
    function (e) {
      var a = findAnchor(e);
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      var href;
      try {
        href = new URL(a.getAttribute('href'), location.href).href;
      } catch (err) {
        href = a.getAttribute('href');
      }
      post({ type: 'presenter:link', href: href });
    },
    true
  );

  document.addEventListener('click', function () {
    // Keep the parent counter honest when the deck's own navigator is used.
    window.setTimeout(function () {
      var p = apiDeck();
      if (p && Number.isFinite(p.currentSlide) && p.currentSlide !== index) {
        index = Math.max(0, Math.min(total - 1, p.currentSlide));
        postState();
        return;
      }
      if (strategy === 'slides' || strategy === 'sections') {
        for (var i = 0; i < els.length; i++) {
          if (els[i].classList.contains('active') || els[i].classList.contains('visible')) {
            if (i !== index) {
              index = i;
              postState();
            }
            return;
          }
        }
      }
    }, 0);
  });

  var style = document.createElement('style');
  style.textContent =
    '.edit-toggle, .edit-toolbar, .edit-mode, [data-edit-ui] { display: none !important; }';
  (document.head || document.documentElement).appendChild(style);
  document.body.classList.add('presenter-readonly');

  var initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;
    discover();
    // Make the first slide visible on load: a no-JS deck typically hides every
    // .slide until one carries `active`. API decks already own their render.
    if (strategy === 'slides' || strategy === 'sections' || strategy === 'api') apply();
    post({ type: 'presenter:ready', total: total, strategy: strategy });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    // A script at the very end of the document can run after readyState turns
    // "interactive" but before the DOMContentLoaded event dispatches. Waiting
    // for the event (and for decks that registered it earlier) lets a deck
    // build its presentation API before we choose a strategy.
    document.addEventListener('DOMContentLoaded', init, { once: true });
    window.setTimeout(init, 100);
  }

  function upgradeIfReady() {
    if (strategy !== 'api' && apiDeck()) {
      discover();
      apply();
      postState();
    }
  }

  window.addEventListener('load', upgradeIfReady);
  var upgradeTimer = window.setInterval(upgradeIfReady, 100);
  window.setTimeout(function () {
    if (upgradeTimer !== null) {
      window.clearInterval(upgradeTimer);
      upgradeTimer = null;
    }
  }, 5000);
})();
