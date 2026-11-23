/* NXT Netzwerkforschung | display-only, bilingual UI layer.
 * Native German strings and stored survey values remain untouched.
 * German is the default; English is applied only to visible text/labels.
 * No data is transmitted to third-party translation services.
 */
(() => {
  'use strict';
  const source = window.NXT_EN_TRANSLATIONS || {};
  const exact = new Map(Object.entries(source));
  const STORAGE_KEY = 'nxt.networkforschung.language.v1';
  const originalText = new WeakMap();
  const lastText = new WeakMap();
  const originalAttrs = new WeakMap();
  const lastAttrs = new WeakMap();
  const SELECTOR = '[data-nxt-language]';
  const ATTRS = ['placeholder','aria-label','title','alt'];
  const SKIP_TEXT = 'script,style,textarea,code,pre,[data-i18n-ignore],[data-i18n-private],[contenteditable="true"],.person-avatar,.nxt-network-user-text,.network-word-list';
  const SKIP_ATTRS = 'script,style,code,pre,[data-i18n-ignore],[data-i18n-private],[contenteditable="true"],.person-avatar,.nxt-network-user-text';
  let language = 'de', scheduled = false, running = false;
  let observer = null;
  const nativeHtmlLang = 'de';

  function getPreference() {
    try { return window.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'de'; }
    catch (_) { return 'de'; }
  }
  function storePreference(value) {
    try { window.localStorage.setItem(STORAGE_KEY, value); } catch (_) { /* Browser may block storage. */ }
  }
  function normalize(s) { return String(s).replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim(); }

  // Dynamic UI counters and phrases: deliberately limited to known interface
  // patterns, so participant names and free-text research answers stay intact.
  const patterns = [
    [/^(\d+)\s+von\s+(\d+)\s+Beziehungen markiert$/i, ([,a,b]) => `${a} of ${b} relationships selected`],
    [/^(\d+)\s+von\s+(\d+)\s+Personen$/i, ([,a,b]) => `${a} of ${b} people`],
    [/^(\d+)\s+Personen\s+von\s+(\d+)$/i, ([,a,b]) => `${a} of ${b} people`],
    [/^(\d+)\s+Personen$/i, ([,n]) => `${n} people`],
    [/^(\d+)\s+Knoten$/i, ([,n]) => `${n} nodes`],
    [/^(\d+)\s+Kanten$/i, ([,n]) => `${n} edges`],
    [/^(\d+)\s+Interviewdatensätze$/i, ([,n]) => `${n} interview records`],
    [/^(\d+)\s+Interviews?$/i, ([,n]) => `${n} interviews`],
    [/^(\d+)\s+Antworten?$/i, ([,n]) => `${n} answers`],
    [/^(\d+)\s+Ortsnennungen$/i, ([,n]) => `${n} location mentions`],
    [/^(\d+)\s+gerichtete Beziehungen$/i, ([,n]) => `${n} directed relationships`],
    [/^(\d+)\s+eingehende Nennungen$/i, ([,n]) => `${n} incoming nominations`],
    [/^(\d+)\s+ausgehende Nennungen$/i, ([,n]) => `${n} outgoing nominations`],
    [/^(\d+)\s+abgeschlossen$/i, ([,n]) => `${n} completed`],
    [/^(\d+)\s+offen$/i, ([,n]) => `${n} pending`],
    [/^(\d+)\s+abgelehnt$/i, ([,n]) => `${n} declined`],
    [/^(\d+)\s+beobachtete Kanten$/i, ([,n]) => `${n} observed edges`],
    [/^(\d+)\s+sichtbare Knoten$/i, ([,n]) => `${n} visible nodes`],
    [/^(\d+)\s+sichtbare Kanten$/i, ([,n]) => `${n} visible edges`],
    [/^(\d+)\s+zugeordnete Personen$/i, ([,n]) => `${n} assigned people`],
    [/^(\d+)\s+Personen zugeordnet$/i, ([,n]) => `${n} people assigned`],
    [/^(\d+)\s+gerichtete Beziehungen$/i, ([,n]) => `${n} directed relationships`],
    [/^(\d+)\s+% Fortschritt$/i, ([,n]) => `${n}% progress`],
    [/^(\d+)\s+% abgeschlossen$/i, ([,n]) => `${n}% completed`],
    [/^Projektziel:\s*ca\.\s*(\d+)\s+Personen$/i, ([,n]) => `Project target: approx. ${n} people`],
    [/^(\d+)\s+offen\s*·\s*(\d+)\s+abgelehnt$/i, ([,a,b]) => `${a} pending · ${b} declined`],
    [/^(\d+)\s+abgeschlossen\s*·\s*(\d+)\s+aktiv$/i, ([,a,b]) => `${a} completed · ${b} active`],
    [/^Bau\s+(\d+|D)$/i, ([,n]) => `Building ${n}`],
    [/^Gebäude\s+(\d+|D)$/i, ([,n]) => `Building ${n}`],
    [/^Raum\s+(\d+[\w.-]*)$/i, ([,n]) => `Room ${n}`],
    [/^(\d+)\s+gerichtete Beziehungen$/i, ([,n]) => `${n} directed relationships`],
    [/^(\d+)\s+der möglichen gerichteten Kanten.*$/i, ([,n]) => `${n} of the possible directed edges`],
    [/^Erhebung:\s*(.+)$/i, ([,v]) => `Survey: ${translate(v)}`],
    [/^Interview\s+(\d+)\s+von\s+(\d+)$/i, ([,a,b]) => `Interview ${a} of ${b}`],
    [/^(\d+)\s+von\s+(\d+)\s+Fragen beantwortet$/i, ([,a,b]) => `${a} of ${b} questions answered`],
    [/^Letzte Aktualisierung:\s*(.+)$/i, ([,v]) => `Last updated: ${v}`],
    [/^Zuletzt geändert:\s*(.+)$/i, ([,v]) => `Last edited: ${v}`],
    [/^Gruppe:\s*(.+)$/i, ([,v]) => `Group: ${translate(v)}`],
    [/^Gebäude:\s*(.+)$/i, ([,v]) => `Building: ${translate(v)}`],
    [/^Status:\s*(.+)$/i, ([,v]) => `Status: ${translate(v)}`],
    [/^Quelle:\s*(.+)$/i, ([,v]) => `Source: ${translate(v)}`],
    [/^Ziel:\s*(.+)$/i, ([,v]) => `Target: ${translate(v)}`],
    [/^\s*Bürostandorte:\s*(.+)$/i, ([,v]) => `Office locations: ${v}`],
    [/^(\d+)\s+Interview[s]? gestartet$/i, ([,n]) => `${n} interviews started`],
    [/^\s*Hinweis:\s*(.+)$/i, ([,v]) => `Note: ${translate(v)}`],
    [/^(.+?)\s+Knoten\s*·\s*(\d+)\s+Kanten$/i, ([,a,b]) => `${a} nodes · ${b} edges`],
    [/^Aktuell sind (\d+) von (\d+) Personen abgeschlossen\. Beim Erfassen werden neue Kanten zentral gespeichert\.$/i, ([,a,b]) => `${a} of ${b} people have completed interviews. New edges are saved to the central database during collection.`],
    [/^(\d+) aktive von (\d+) Zugängen$/i, ([,a,b]) => `${a} active of ${b} accounts`],
    [/^(\d+) von (\d+) abgeschlossen$/i, ([,a,b]) => `${a} of ${b} completed`],
    [/^(\d+) von (\d+) Personen abgeschlossen$/i, ([,a,b]) => `${a} of ${b} people completed`],
    [/^(\d+) Personen in aktueller Auswahl · (\d+) Kanten · (\d+) unverortet$/i, ([,a,b,c]) => `${a} selected people · ${b} edges · ${c} without location`],
    [/^(\d+) gefilterte Kanten ohne vollständige räumliche Zuordnung werden nicht in der Matrix gezählt\.$/i, ([,n]) => `${n} filtered edges without complete location data are not counted in the matrix.`],
    [/^(\d+) Personen ohne auswertbare Gebäudeangabe \(bei aktiver Mitarbeitergruppen-Auswahl\)\.$/i, ([,n]) => `${n} people have no usable building assignment (with the staff group filter active).`],
    [/^(\d+) Notizfelder$/i, ([,n]) => `${n} note fields`],
    [/^(\d+) Knoten · (\d+) Kanten · (\d+) Komponenten$/i, ([,a,b,c]) => `${a} nodes · ${b} edges · ${c} components`],
    [/^(\d+) interne fachliche Kanten$/i, ([,n]) => `${n} internal professional edges`],
    [/^(\d+) fachliche Nennungen$/i, ([,n]) => `${n} professional nominations`],
    [/^(\d+) von (\d+) Knoten sichtbar$/i, ([,a,b]) => `${a} of ${b} nodes visible`],
    [/^Dichte: ([\d.,]+) % der möglichen gerichteten Kanten.*$/i, ([,n]) => `Density: ${n}% of possible directed edges have been recorded. People without interviews are not treated as having no connections.`],
    [/^Beidseitige Nennung: ([\d.,]+) % der berichteten Kanten haben derzeit eine Gegennennung;.*$/i, ([,n]) => `Reciprocity: ${n}% of reported edges currently have a matching nomination in the opposite direction; unanswered interviews do not imply a negative response.`],
    [/^Isolierte Personen: (\d+) von (\d+) haben derzeit keine dokumentierte fachliche Beziehung\.$/i, ([,a,b]) => `Isolates: ${a} of ${b} people currently have no documented professional relationship.`],
    [/^Netzwerkkomponenten: (\d+) schwach verbundene Teilnetze; größte Komponente: (\d+) Personen\.$/i, ([,a,b]) => `Network components: ${a} weakly connected components; the largest contains ${b} people.`],
    [/^Interviewabdeckung: (\d+) von (\d+) Personen sind vollständig abgeschlossen \(([\d.,]+) %\)\.$/i, ([,a,b,c]) => `Interview coverage: ${a} of ${b} people completed (${c}%).`],
    [/^Zwischen Gebäuden: (\d+) von (\d+) räumlich zuordenbaren Kanten \(([\d.,]+) %\)\. (\d+) Kanten ohne vollständige Gebäudedaten\.$/i, ([,a,b,c,d]) => `Across buildings: ${a} of ${b} spatially assigned edges (${c}%). ${d} edges lack complete building data.`],
    [/^(.+?) · (\d+) Personen$/i, ([,a,b]) => `${translate(a)} · ${b} people`],
    [/^(.+?) · (\d+) gerichtete Beziehungen$/i, ([,a,b]) => `${translate(a)} · ${b} directed relationships`],
    [/^(\d+) Kanten ohne vollständige Gebäudedaten\.$/i, ([,n]) => `${n} edges lack complete building data.`],
    [/^(\d+) Datensätze? gespeichert$/i, ([,n]) => `${n} records saved`],
    [/^(.+) · Standorte$/i, ([,a]) => `${translate(a)} · Locations`],
    [/^\. Die Person, ihre Stammdaten und alle Interviews anderer Personen bleiben erhalten\. Exportiere bei Bedarf vorher eine Sicherung\.$/i, () => `. The person, their master data and all other people's interviews are preserved. Export a backup beforehand if needed.`],
  ];

  function translate(raw) {
    if (raw == null || raw === '') return raw;
    const text = normalize(raw);
    if (!text) return raw;
    let result = exact.get(text);
    if (result === undefined) {
      for (const [regex, formatter] of patterns) {
        const match = text.match(regex);
        if (match) { result = formatter(match); break; }
      }
    }
    if (result === undefined || result === text) return raw;
    // Preserve outer whitespace; inner whitespace is replaced by the translated text.
    const start = String(raw).match(/^\s*/)[0];
    const end = String(raw).match(/\s*$/)[0];
    return start + result + end;
  }

  function inUserInput(node) {
    const parent = node.nodeType === 3 ? node.parentElement : node;
    if (!parent || parent.nodeType !== 1) return true;
    return Boolean(parent.closest(SKIP_TEXT));
  }
  function convertText(node) {
    if (!node || node.nodeType !== 3 || inUserInput(node)) return;
    const value = node.nodeValue;
    // If the app updates a reused text node, use the new source text.
    if (!originalText.has(node) || (value !== lastText.get(node) && value !== originalText.get(node))) {
      originalText.set(node, value);
    }
    const base = originalText.get(node);
    const target = language === 'en' ? translate(base) : base;
    if (target !== value) node.nodeValue = target;
    lastText.set(node, target);
  }
  function convertAttrs(el) {
    if (!el || el.nodeType !== 1 || el.closest(SKIP_ATTRS)) return;
    let originals = originalAttrs.get(el);
    if (!originals) { originals = {}; originalAttrs.set(el, originals); }
    let previous = lastAttrs.get(el);
    if (!previous) { previous = {}; lastAttrs.set(el, previous); }
    for (const attr of ATTRS) {
      if (!el.hasAttribute(attr)) continue;
      const value = el.getAttribute(attr);
      if (!Object.prototype.hasOwnProperty.call(originals, attr) ||
         (value !== previous[attr] && value !== originals[attr])) originals[attr] = value;
      const next = language === 'en' ? translate(originals[attr]) : originals[attr];
      if (next !== value) el.setAttribute(attr, next);
      previous[attr] = next;
    }
  }
  function translateTree(start) {
    if (!start || running) return;
    running = true;
    try {
      if (start.nodeType === 3) { convertText(start); return; }
      if (start.nodeType !== 1 && start.nodeType !== 9 && start.nodeType !== 11) return;
      if (start.nodeType === 1 && start.matches(SKIP_TEXT) && start.matches(SKIP_ATTRS)) return;
      if (start.nodeType === 1) convertAttrs(start);
      const els = start.querySelectorAll ? start.querySelectorAll('*') : [];
      for (const el of els) convertAttrs(el);
      const walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT);
      let current;
      while ((current = walker.nextNode())) convertText(current);
    } finally { running = false; }
  }
  function syncSelectors() {
    for (const s of document.querySelectorAll(SELECTOR)) {
      if (s.value !== language) s.value = language;
    }
  }
  function updateDocument() {
    document.documentElement.lang = language === 'en' ? 'en' : nativeHtmlLang;
    document.title = language === 'en' ? 'NXT | Network Research' : 'NXT | Netzwerkforschung';
  }
  function update() {
    if (!document.body) return;
    updateDocument();
    translateTree(document.body);
    syncSelectors();
  }
  function setLanguage(next) {
    if (next !== 'de' && next !== 'en') return;
    language = next;
    storePreference(next);
    update();
    window.dispatchEvent(new CustomEvent('nxt:languagechange', {detail:{language:next}}));
  }
  function confirm(message) { return window.confirm(language === 'en' ? translate(message) : message); }
  function alert(message) { return window.alert(language === 'en' ? translate(message) : message); }
  function selector(mode='topbar') {
    const isAuth=mode==='login';
    return `<label class="nxt-language-control ${isAuth?'nxt-language-auth':''}" title="Sprache / Language">
      <span class="nxt-language-globe" aria-hidden="true">🌐</span>
      <span class="nxt-language-caption">Sprache</span>
      <select data-nxt-language aria-label="Sprache / Language" autocomplete="off">
        <option value="de" ${language==='de'?'selected':''}>Deutsch</option>
        <option value="en" ${language==='en'?'selected':''}>English</option>
      </select>
    </label>`;
  }
  function install() {
    if (!document.body) return;
    if (!document.documentElement.dataset.nxtI18n) {
      document.documentElement.dataset.nxtI18n = 'ready';
      document.addEventListener('change',e => {
        const input = e.target.closest?.(SELECTOR);
        if (!input) return;
        setLanguage(input.value);
      });
    }
    if (!observer) {
      observer = new MutationObserver(records => {
        if (running || scheduled) return;
        // Queue at most once for a burst of UI rerenders or live data events.
        scheduled = true;
        Promise.resolve().then(() => { scheduled = false; update(); });
      });
      observer.observe(document.body, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
    }
    update();
  }
  language = getPreference();
  window.NXT_I18N = Object.freeze({
    getLanguage:()=>language,
    setLanguage,selector,translate,confirm,alert,
    refresh:update,
    start:install
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install,{once:true});
  else install();
})();