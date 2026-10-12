// js/search.js — index.html controller

import { searchMovies } from './api.js';
import { populateGenres, renderMovies } from './ui.js';
import { addPick, renderWatchlist, randomPick, updateCounter } from './watchlist.js';

const form        = document.getElementById('search-form');
const input       = document.getElementById('search-input');
const genreEl     = document.getElementById('filter-genre');
const ratingEl    = document.getElementById('filter-rating');
const yearEl      = document.getElementById('filter-year');
const sortEl      = document.getElementById('sort-by');
const grid        = document.getElementById('movie-grid');
const statusEl    = document.getElementById('results-status');
const loadMoreBtn = document.getElementById('load-more-btn');
const surpriseBtn = document.getElementById('surprise-btn');

// Single state object — source of truth for the current search session
const state = {
  query:      '',
  genre:      '',
  minRating:  '',
  decade:     '',
  sort:       'popularity.desc',
  page:       1,
  totalPages: 1,
  rawResults: [],   // all pages fetched so far (unfiltered)
};

/** Client-side filter — used when /search/movie ignores server-side params. */
function applyFilters(movies) {
  return movies.filter(m => {
    if (state.genre     && !m.genre_ids?.includes(+state.genre))          return false;
    if (state.minRating && (m.vote_average ?? 0) < +state.minRating)      return false;
    if (state.decade) {
      const year = +(m.release_date?.slice(0, 4) ?? 0);
      if (year < +state.decade || year > +state.decade + 9)               return false;
    }
    return true;
  });
}

/** Sort a movie array by the current sort state (client-side, for search results). */
function applySort(movies) {
  const [field, dir] = state.sort.split('.');
  const asc = dir === 'asc';
  return [...movies].sort((a, b) => {
    const va = field === 'release_date' ? (a.release_date ?? '') : (a[field] ?? 0);
    const vb = field === 'release_date' ? (b.release_date ?? '') : (b[field] ?? 0);
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ?  1 : -1;
    return 0;
  });
}

function readFilters() {
  state.query     = input.value.trim();
  state.genre     = genreEl.value;
  state.minRating = ratingEl.value;
  state.decade    = yearEl.value;
  state.sort      = sortEl.value;
}

function showRetry() {
  loadMoreBtn.classList.add('hidden');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-secondary';
  btn.id = 'retry-btn';
  btn.textContent = '⟳ Retry';
  btn.addEventListener('click', () => { btn.remove(); doSearch(1); });
  statusEl.insertAdjacentElement('afterend', btn);
}

function removeRetry() {
  document.getElementById('retry-btn')?.remove();
}

async function doSearch(page = 1, append = false) {
  removeRetry();
  statusEl.textContent = 'Searching…';
  loadMoreBtn.classList.add('hidden');

  if (!append) {
    state.page = 1;
    state.rawResults = [];
    grid.innerHTML = '';
  }

  try {
    // Pass filters to API only when using /discover/movie (no text query)
    const data = await searchMovies({
      query:     state.query,
      genre:     state.query ? '' : state.genre,
      minRating: state.query ? '' : state.minRating,
      decade:    state.query ? '' : state.decade,
      sort:      state.sort,
      page,
    });

    state.rawResults = [...state.rawResults, ...data.results];
    state.page       = data.page;
    state.totalPages = data.totalPages;

    // When a text query is active, filter and sort client-side
    const visible = state.query
      ? applySort(applyFilters(state.rawResults))
      : state.rawResults;

    if (visible.length === 0 && page === 1) {
      statusEl.textContent = 'No movies found. Try different filters.';
      return;
    }

    if (!append) grid.innerHTML = '';
    await renderMovies(visible, grid, { showAdd: true, showRemove: false });

    const label = state.query ? `Results for "${state.query}"` : 'Showing';
    statusEl.textContent = `${label} (${visible.length} of ${data.totalResults})`;

    if (state.page < state.totalPages) loadMoreBtn.classList.remove('hidden');

    // Persist state so details.html can link back
    sessionStorage.setItem('searchState', JSON.stringify({
      query: state.query, genre: state.genre, minRating: state.minRating,
      decade: state.decade, sort: state.sort,
    }));

  } catch (err) {
    if (err.message === 'RATE_LIMIT') {
      statusEl.textContent = 'Too many requests — please wait a moment.';
    } else {
      statusEl.textContent = `Error: ${err.message}`;
    }
    showRetry();
  }
}

/** Surprise Me — random pick from shortlist, falls back to current results. */
function surpriseMe() {
  const pick = randomPick(state.rawResults);
  if (!pick) {
    statusEl.textContent = 'Search for movies first, then try Surprise Me!';
    return;
  }
  window.location.href = `details.html?id=${pick.id}`;
}

/** Delegate add-to-picks clicks on the results grid. */
function handleGridClick(e) {
  const btn = e.target.closest('[data-action="add"]');
  if (!btn) return;
  const movie = state.rawResults.find(m => m.id === +btn.dataset.id);
  if (movie) {
    addPick(movie);
    renderWatchlist();
    btn.textContent = '✓ Added';
    btn.disabled = true;
  }
}

// ── Event listeners ──────────────────────────────────────────
form.addEventListener('submit', e => { e.preventDefault(); readFilters(); doSearch(1); });

[genreEl, ratingEl, yearEl, sortEl].forEach(el =>
  el.addEventListener('change', () => { readFilters(); doSearch(1); })
);

loadMoreBtn.addEventListener('click', () => doSearch(state.page + 1, true));
surpriseBtn.addEventListener('click', surpriseMe);
grid.addEventListener('click', handleGridClick);

// ── Init ─────────────────────────────────────────────────────
(async () => {
  await populateGenres(genreEl);

  // Restore previous search state if returning from details page
  const saved = sessionStorage.getItem('searchState');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      input.value    = s.query     ?? '';
      genreEl.value  = s.genre     ?? '';
      ratingEl.value = s.minRating ?? '';
      yearEl.value   = s.decade    ?? '';
      sortEl.value   = s.sort      ?? 'popularity.desc';
    } catch { /* ignore corrupted session state */ }
  }

  readFilters();
  doSearch(1);
  updateCounter();
})();
