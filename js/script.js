'use strict';

/**
 * QuickStock Sync landing page — small, dependency-free interactions.
 * No framework, no build step, matching the product's own philosophy.
 */

document.addEventListener('DOMContentLoaded', () => {
  setFooterYear();
  initMobileNav();
  initScrollReveal();
  initHeroCounters();
  fetchStarCount();
});

/** Fills in the footer's copyright year automatically. */
function setFooterYear() {
  const el = document.getElementById('footer-year');
  if (el) el.textContent = new Date().getFullYear();
}

/** Toggles the mobile navigation drawer. */
function initMobileNav() {
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('mobile-nav');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    });
  });
}

/**
 * Reveals elements with the ".reveal" class as they scroll into view.
 * Falls back to showing everything immediately if IntersectionObserver
 * isn't available, or if the user prefers reduced motion.
 */
function initScrollReveal() {
  const targets = document.querySelectorAll('.reveal');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!('IntersectionObserver' in window) || prefersReducedMotion) {
    targets.forEach((el) => el.classList.add('in-view'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  targets.forEach((el, index) => {
    // Small stagger within the same section for a nicer cascade, capped
    // so long sections don't take forever to finish revealing.
    el.style.transitionDelay = `${Math.min(index % 6, 5) * 60}ms`;
    observer.observe(el);
  });
}

/**
 * Animates the quantity numbers in the hero's "live ledger" panel from 0
 * up to their real value once the panel scrolls into view.
 */
function initHeroCounters() {
  const rows = document.getElementById('ledger-rows');
  if (!rows) return;

  const counters = rows.querySelectorAll('[data-count]');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const runCounters = () => {
    counters.forEach((el) => {
      const target = Number(el.dataset.count) || 0;
      if (prefersReducedMotion || target === 0) {
        el.textContent = String(target);
        return;
      }
      animateCount(el, target);
    });
  };

  if (!('IntersectionObserver' in window)) {
    runCounters();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          runCounters();
          observer.disconnect();
        }
      });
    },
    { threshold: 0.4 }
  );
  observer.observe(rows);
}

/**
 * Animates a single element's text content from 0 to a target integer.
 * @param {HTMLElement} el
 * @param {number} target
 */
function animateCount(el, target) {
  const duration = 900;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = String(Math.round(eased * target));
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

/**
 * Fetches the real, current GitHub star count for the repository and
 * displays it in the header button — falls back to a star glyph if the
 * request fails or is blocked (e.g. offline), never showing a fabricated number.
 */
async function fetchStarCount() {
  const el = document.getElementById('star-count');
  if (!el) return;

  try {
    const res = await fetch('https://api.github.com/repos/SHalimoosavi/SYJ-QuickStock-Sync', {
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.stargazers_count === 'number') {
      el.textContent = formatStarCount(data.stargazers_count);
    }
  } catch {
    // Network error, rate limit, or offline — keep the default glyph rather
    // than showing a stale or fabricated number.
  }
}

/**
 * Formats a star count compactly (e.g. 1200 -> "1.2k").
 * @param {number} n
 * @returns {string}
 */
function formatStarCount(n) {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}
