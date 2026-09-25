/* R73: one lightweight presentation controller for the complete match. */
(function () {
  'use strict';
  const VERSION = 73;
  const $ = id => document.getElementById(id);
  const phaseIds = {
    hub: 'command-hub', initiative: 'initiative-phase', draft: 'draft-phase',
    scroll: 'scroll-phase', arena: 'arena-phase', battle: 'battle-phase', end: 'end-screen'
  };
  const actionIds = {
    hub: ['hub-start-btn'], initiative: ['roll-init-btn', 'start-draft-btn'],
    draft: ['draft-keep-btn', 'draft-pass-btn'], scroll: ['roll-scrolls-btn', 'confirm-scroll-btn'],
    arena: ['roll-arena-btn', 'enter-battle-btn'], battle: ['lock-p1-btn', 'lock-p2-btn', 'fight-btn'],
    end: ['end-action-btn']
  };
  let frame = 0, lastKey = '', coachAnchor, fightAnchor;
  const coach = $('r33-coach'), fight = $('fight-btn');

  function viewport() {
    const v = window.visualViewport;
    return {
      width: Math.round(v?.width || innerWidth || document.documentElement.clientWidth),
      height: Math.round(v?.height || innerHeight || document.documentElement.clientHeight)
    };
  }
  function classify(v) {
    if (v.width <= 600 && v.height >= v.width) return v.height <= 700 ? 'phone-short' : 'phone-portrait';
    if (v.width <= 950 && v.height < v.width) return 'phone-landscape';
    if (v.width <= 1100) return 'tablet';
    return 'desktop';
  }
  function density(v, profile) {
    if (profile === 'phone-landscape') return v.height <= 430 ? 'short' : 'normal';
    if (profile.startsWith('phone')) return v.height <= 700 ? 'short' : 'normal';
    return v.height <= 780 ? 'short' : v.height >= 1000 ? 'tall' : 'normal';
  }
  function phase() { return document.body.dataset.r27Phase || document.body.dataset.r18Phase || 'hub'; }
  function mode() { return document.body.classList.contains('r34-training-active') ? 'tutorial' : 'normal'; }
  function anchor(node, label) {
    if (!node?.parentNode) return null;
    const point = document.createComment(label);
    node.parentNode.insertBefore(point, node);
    return point;
  }
  function restore(node, point) {
    if (node && point?.parentNode && node.previousSibling !== point)
      point.parentNode.insertBefore(node, point.nextSibling);
  }
  function placeCoach(currentPhase, currentMode, profile) {
    if (!coach || profile === 'phone-portrait' || profile === 'phone-short') return;
    const root = $(phaseIds[currentPhase]);
    if (currentMode === 'tutorial' && currentPhase !== 'hub' && root) {
      if (coach.parentNode !== root || coach !== root.firstChild) root.insertBefore(coach, root.firstChild);
    } else restore(coach, coachAnchor);
  }
  function placeFightButton() {
    const root = $('battle-phase'), summary = $('combat-summary');
    if (root && summary && fight?.parentNode !== root) root.insertBefore(fight, summary);
  }
  function update() {
    frame = 0;
    const body = document.body, v = viewport(), profile = classify(v);
    const currentPhase = phase(), currentMode = mode(), currentDensity = density(v, profile);
    const key = [v.width, v.height, profile, currentMode, currentDensity, currentPhase].join(':');
    if (key === lastKey) return;
    lastKey = key;
    body.classList.add('r73-layout');
    body.dataset.r73Profile = profile;
    body.dataset.r73Mode = currentMode;
    body.dataset.r73Density = currentDensity;
    body.dataset.r73Phase = currentPhase;
    placeFightButton();
    placeCoach(currentPhase, currentMode, profile);
    document.dispatchEvent(new CustomEvent('r73:layout', {
      detail: { version: VERSION, viewport: v, profile, mode: currentMode, density: currentDensity, phase: currentPhase }
    }));
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  function visibleRect(el) {
    if (!el || el.classList.contains('hidden')) return null;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  }
  function audit() {
    const v = viewport(), currentPhase = phase(), scrollArea = $('scroll-team-grid');
    const controls = (actionIds[currentPhase] || []).map(id => {
      const el = $(id), r = visibleRect(el);
      return {
        id, visible: Boolean(r), enabled: Boolean(el && !el.disabled && !el.classList.contains('pointer-events-none')),
        inViewport: Boolean(r && r.x >= -2 && r.right <= v.width + 2 && r.y >= -2 && r.bottom <= v.height + 2)
      };
    });
    return Object.freeze({
      version: VERSION, viewport: v, phase: currentPhase,
      profile: document.body.dataset.r73Profile, mode: document.body.dataset.r73Mode,
      horizontalOverflowPx: Math.max(0, Math.ceil(document.documentElement.scrollWidth - v.width)),
      actions: controls, scrollAreaHeight: scrollArea ? Math.round(scrollArea.getBoundingClientRect().height) : 0
    });
  }
  function start() {
    coachAnchor = anchor(coach, 'r73-coach-home');
    fightAnchor = anchor(fight, 'r73-fight-home');
    update();
    document.addEventListener('r27:phase-change', schedule);
    document.addEventListener('r34:mode-change', schedule);
    document.addEventListener('r34:ready', schedule);
    addEventListener('resize', schedule, { passive: true });
    addEventListener('orientationchange', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    addEventListener('pagehide', () => {
      if (frame) cancelAnimationFrame(frame);
      restore(fight, fightAnchor);
      restore(coach, coachAnchor);
    }, { once: true });
  }
  window.R73_LAYOUT = Object.freeze({ version: VERSION, refresh: schedule, audit, viewport });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
