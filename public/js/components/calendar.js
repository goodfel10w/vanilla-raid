// ── Calendar Component ──

import { h, formatDate } from '../utils.js';

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WEEKDAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/**
 * Render a monthly calendar with raid markers.
 * @param {Date} refDate - Reference date for the month to display
 * @param {Array} raids - Array of raid objects
 * @param {Object} [opts]
 * @returns {string} HTML
 */
export function monthlyCalendar(refDate, raids, opts = {}) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7; // Monday = 0

  // Group raids by date
  const raidsByDate = {};
  raids.forEach(r => {
    if (!raidsByDate[r.date]) raidsByDate[r.date] = [];
    raidsByDate[r.date].push(r);
  });

  let html = `<div class="cal-container">
    <div class="cal-nav">
      <button class="btn-icon cal-prev" data-action="cal-prev" aria-label="Vorheriger Monat">&larr;</button>
      <span class="cal-title">${MONTH_NAMES[month]} ${year}</span>
      <button class="btn-icon cal-next" data-action="cal-next" aria-label="Nächster Monat">&rarr;</button>
    </div>
    <div class="cal-grid">
      <div class="cal-weekdays">${WEEKDAY_NAMES.map(d => `<div class="cal-weekday">${d}</div>`).join('')}</div>
      <div class="cal-days">`;

  // Empty cells before first day
  for (let i = 0; i < startDow; i++) {
    html += '<div class="cal-day cal-day-empty"></div>';
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const dayRaids = raidsByDate[dateStr] || [];
    const hasRaids = dayRaids.length > 0;

    html += `<div class="cal-day${isToday ? ' cal-today' : ''}${hasRaids ? ' cal-has-raids' : ''}">
      <div class="cal-day-num">${d}</div>`;
    dayRaids.forEach(r => {
      const signups = r.signups || [];
      html += `<a class="cal-raid" href="#/raids/${r.id}" title="${h(r.instance)}">
        <span class="cal-raid-name">${h(r.instance.length > 12 ? r.instance.slice(0, 10) + '..' : r.instance)}</span>
        <span class="cal-raid-time">${r.time}</span>
        <span class="cal-raid-info">${signups.length}/${r.maxPlayers}</span>
      </a>`;
    });
    html += '</div>';
  }

  html += '</div></div></div>';
  return html;
}

/**
 * Render a weekly strip calendar.
 * @param {Date} refDate
 * @param {Array} raids
 * @returns {string} HTML
 */
export function weeklyCalendar(refDate, raids) {
  const monday = new Date(refDate);
  const dow = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - dow);

  const raidsByDate = {};
  raids.forEach(r => {
    if (!raidsByDate[r.date]) raidsByDate[r.date] = [];
    raidsByDate[r.date].push(r);
  });

  const today = new Date().toISOString().slice(0, 10);

  let html = `<div class="cal-week-container">
    <div class="cal-nav">
      <button class="btn-icon" data-action="cal-prev" aria-label="Vorherige Woche">&larr;</button>
      <span class="cal-title">KW ${getWeekNumber(monday)}</span>
      <button class="btn-icon" data-action="cal-next" aria-label="Nächste Woche">&rarr;</button>
    </div>`;

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const isToday = dateStr === today;
    const dayRaids = raidsByDate[dateStr] || [];

    html += `<div class="cal-week-row${isToday ? ' cal-today' : ''}">
      <div class="cal-week-day">
        <span>${WEEKDAY_NAMES[i]}</span>
        <span class="cal-week-day-date">${d.getDate()}.${d.getMonth() + 1}.</span>
      </div>`;

    if (dayRaids.length) {
      dayRaids.forEach(r => {
        const signups = r.signups || [];
        html += `<a class="cal-week-card" href="#/raids/${r.id}">
          <span class="cal-week-inst">${h(r.instance)}</span>
          <span class="cal-week-meta">
            <span>${r.time}</span>
            <span class="cal-week-signup">${signups.length}/${r.maxPlayers}</span>
          </span>
        </a>`;
      });
    } else {
      html += '<div class="cal-week-empty">—</div>';
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

function getWeekNumber(d) {
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d - oneJan) / 86400000);
  return Math.ceil((days + oneJan.getDay() + 1) / 7);
}
