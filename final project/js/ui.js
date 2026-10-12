// js/ui.js — DOM-building helpers (XSS-safe: textContent for all API data)

import { posterUrl } from './api.js';

// Cached genre map: { id → name }
let genreMap = {};

/** Load genres.json and cache as a lookup map. */
async function loadGenreMap() {
  if (Object.keys(genreMap).length) return;
  const res = await fetch('/data/genres.json');
  const list = await res.json();
  list.forEach(({ id, name }) => { genreMap[id] = name; });
}

/** Convert an array of genre_ids to a readable comma-separated string. */
export function genreIdsToNames(ids = []) {
  return ids.map(id => genreMap[id]).filter(Boolean).join(', ') || '—';
}

/** Populate a genre <select> element from genres.json. */
export async function populateGenres(selectEl) {
  await loadGenreMap();
  Object.entries(genreMap).forEach(([id, name]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = name;
    selectEl.appendChild(opt);
  });
}

/**
 * Build and return a movie card <article> element.
 * All API-sourced text is set via textContent — never innerHTML.
 */
export async function createMovieCard(movie, { showAdd = true, showRemove = false } = {}) {
  await loadGenreMap();
  const { id, title, release_date, vote_average, poster_path, genre_ids = [] } = movie;
  const year   = release_date?.slice(0, 4) ?? '—';
  const score  = vote_average ? vote_average.toFixed(1) : 'N/A';
  const genres = genreIdsToNames(genre_ids);
  const img    = await posterUrl(poster_path);

  const card = document.createElement('article');
  card.className = 'movie-card';
  card.dataset.id = id;

  // Poster link
  const posterLink = document.createElement('a');
  posterLink.href = `details.html?id=${id}`;
  posterLink.setAttribute('aria-label', `View details for ${title}`);
  const posterImg = document.createElement('img');
  posterImg.src     = img;
  posterImg.alt     = `${title} poster`;
  posterImg.loading = 'lazy';
  posterLink.appendChild(posterImg);

  // Card body
  const body = document.createElement('div');
  body.className = 'card-body';

  const titleEl = document.createElement('p');
  titleEl.className = 'card-title';
  titleEl.textContent = title;

  const metaEl = document.createElement('p');
  metaEl.className = 'card-meta';
  metaEl.textContent = `${year} · ${genres}`;

  const ratingEl = document.createElement('p');
  ratingEl.className = 'card-rating';
  ratingEl.textContent = `★ ${score}`;

  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const detailsLink = document.createElement('a');
  detailsLink.href = `details.html?id=${id}`;
  detailsLink.className = 'btn-secondary btn-sm';
  detailsLink.textContent = 'Details';

  actions.appendChild(detailsLink);

  if (showAdd) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-add';
    addBtn.dataset.action = 'add';
    addBtn.dataset.id = id;
    addBtn.textContent = '+ Pick';
    actions.appendChild(addBtn);
  }

  if (showRemove) {
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-danger';
    removeBtn.dataset.action = 'remove';
    removeBtn.dataset.id = id;
    removeBtn.textContent = 'Remove';
    actions.appendChild(removeBtn);
  }

  body.append(titleEl, metaEl, ratingEl, actions);
  card.append(posterLink, body);
  return card;
}

/** Render an array of movie objects into a grid element. */
export async function renderMovies(movies, gridEl, opts = {}) {
  const cards = await Promise.all(movies.map(m => createMovieCard(m, opts)));
  cards.forEach(card => gridEl.appendChild(card));
}

/** Show a plain-text status/error message inside a container. */
export function showMessage(container, text, isError = false) {
  container.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'status-msg';
  if (isError) p.style.color = 'var(--danger)';
  p.textContent = text;
  container.appendChild(p);
}
