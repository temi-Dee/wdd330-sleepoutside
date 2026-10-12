// js/watchlist.js — Tonight's Picks via localStorage key "tonightsPicks"

import { renderMovies } from './ui.js';

const KEY = 'tonightsPicks';

/** Safe JSON parse — clears corrupted data instead of crashing. */
export function getPicks() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    localStorage.removeItem(KEY);
    return [];
  }
}

/** Store only the fields we need to render a card. */
export function addPick(movie) {
  const list = getPicks();
  if (list.find(m => m.id === movie.id)) return;
  const slim = {
    id:           movie.id,
    title:        movie.title,
    poster_path:  movie.poster_path ?? null,
    vote_average: movie.vote_average ?? 0,
    release_date: movie.release_date ?? '',
    genre_ids:    movie.genre_ids ?? [],
  };
  localStorage.setItem(KEY, JSON.stringify([...list, slim]));
  updateCounter();
}

export function removePick(id) {
  const updated = getPicks().filter(m => m.id !== +id);
  localStorage.setItem(KEY, JSON.stringify(updated));
  updateCounter();
}

export function isPicked(id) {
  return getPicks().some(m => m.id === +id);
}

/**
 * Return a random pick from the shortlist.
 * Falls back to `source` array (current filtered results) if shortlist is empty.
 */
export function randomPick(source = []) {
  const pool = getPicks().length ? getPicks() : source;
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Update the "Tonight's Picks (N)" counter in the header. */
export function updateCounter() {
  const el = document.getElementById('picks-count');
  if (el) el.textContent = `(${getPicks().length})`;
}

/** Re-render the watchlist grid on index.html. */
export async function renderWatchlist() {
  const grid  = document.getElementById('watchlist-grid');
  const empty = document.getElementById('watchlist-empty');
  if (!grid) return;

  grid.innerHTML = '';
  const movies = getPicks();

  if (movies.length === 0) {
    empty?.classList.remove('hidden');
  } else {
    empty?.classList.add('hidden');
    await renderMovies(movies, grid, { showAdd: false, showRemove: true });
  }
  updateCounter();
}

// ── Init on index.html ───────────────────────────────────────
const watchlistGrid = document.getElementById('watchlist-grid');
if (watchlistGrid) {
  renderWatchlist();
  watchlistGrid.addEventListener('click', e => {
    const btn = e.target.closest('[data-action="remove"]');
    if (!btn) return;
    removePick(btn.dataset.id);
    renderWatchlist();
  });
}
