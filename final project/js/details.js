// js/details.js — details.html controller

import { fetchFullDetails, posterUrl } from './api.js';
import { addPick, isPicked } from './watchlist.js';

const container = document.getElementById('detail-container');

/** Build the detail view using safe DOM methods — no innerHTML for API data. */
async function renderDetail(movieId) {
  container.innerHTML = '';
  container.setAttribute('aria-busy', 'true');

  const loading = document.createElement('p');
  loading.className = 'status-msg';
  loading.textContent = 'Loading…';
  container.appendChild(loading);

  try {
    const { tmdb, omdb } = await fetchFullDetails(movieId);

    document.title = `${tmdb.title} – Movie Night Finder`;

    const img    = await posterUrl(tmdb.poster_path);
    const year   = tmdb.release_date?.slice(0, 4) ?? '—';
    const inList = isPicked(tmdb.id);

    container.innerHTML = '';
    container.removeAttribute('aria-busy');

    // ── Poster ───────────────────────────────────────────────
    const poster = document.createElement('img');
    poster.className = 'detail-poster';
    poster.src = img;
    poster.alt = `${tmdb.title} poster`;

    // ── Info column ──────────────────────────────────────────
    const info = document.createElement('div');
    info.className = 'detail-info';

    const titleEl = document.createElement('h2');
    titleEl.textContent = `${tmdb.title} (${year})`;

    // Meta row
    const meta = document.createElement('div');
    meta.className = 'detail-meta';

    const metaItems = [
      `⏱ ${omdb?.runtime ?? (tmdb.runtime ? `${tmdb.runtime} min` : '—')}`,
      `🎬 ${omdb?.director ?? '—'}`,
      `🎭 ${omdb?.actors ?? '—'}`,
    ];
    metaItems.forEach(text => {
      const span = document.createElement('span');
      span.textContent = text;
      meta.appendChild(span);
    });

    // Rating pills
    const ratings = document.createElement('div');
    ratings.className = 'detail-ratings';

    [
      ['TMDB',  tmdb.vote_average?.toFixed(1) ?? 'N/A'],
      ['IMDb',  omdb?.imdbRating ?? 'N/A'],
      ['🍅',    omdb?.rottenTomatoes ?? 'N/A'],
    ].forEach(([label, value]) => {
      const badge = document.createElement('div');
      badge.className = 'rating-badge';
      badge.textContent = `${label} `;
      const strong = document.createElement('strong');
      strong.textContent = value;
      badge.appendChild(strong);
      ratings.appendChild(badge);
    });

    // Overview
    const overview = document.createElement('p');
    overview.className = 'detail-overview';
    overview.textContent = tmdb.overview || 'No overview available.';

    // Genre tags
    const genreRow = document.createElement('div');
    genreRow.className = 'detail-genres';
    (tmdb.genres ?? []).forEach(({ name }) => {
      const tag = document.createElement('span');
      tag.className = 'genre-tag';
      tag.textContent = name;
      genreRow.appendChild(tag);
    });

    // Add to Picks button
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-primary';
    addBtn.textContent = inList ? "✓ In Tonight's Picks" : '+ Add to Tonight\'s Picks';
    if (inList) addBtn.disabled = true;

    addBtn.addEventListener('click', () => {
      addPick({
        id:           tmdb.id,
        title:        tmdb.title,
        poster_path:  tmdb.poster_path,
        vote_average: tmdb.vote_average,
        release_date: tmdb.release_date,
        genre_ids:    tmdb.genres?.map(g => g.id) ?? [],
      });
      addBtn.textContent = "✓ In Tonight's Picks";
      addBtn.disabled = true;
    });

    info.append(titleEl, meta, ratings, overview, genreRow, addBtn);
    container.append(poster, info);

  } catch (err) {
    container.innerHTML = '';
    container.removeAttribute('aria-busy');

    const msg = document.createElement('p');
    msg.className = 'status-msg';
    msg.style.color = 'var(--danger)';
    msg.textContent = err.message === 'RATE_LIMIT'
      ? 'Too many requests — please wait a moment, then reload.'
      : `Failed to load movie: ${err.message}`;
    container.appendChild(msg);

    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn-secondary';
    retryBtn.textContent = '⟳ Retry';
    retryBtn.style.marginTop = '1rem';
    retryBtn.addEventListener('click', () => renderDetail(movieId));
    container.appendChild(retryBtn);
  }
}

// ── Back link: restore previous search URL ───────────────────
const backLink = document.querySelector('.nav-link[href="index.html"]');
if (backLink) {
  const saved = sessionStorage.getItem('searchState');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      const params = new URLSearchParams();
      if (s.query)     params.set('q',      s.query);
      if (s.genre)     params.set('genre',  s.genre);
      if (s.minRating) params.set('rating', s.minRating);
      if (s.decade)    params.set('decade', s.decade);
      if (s.sort)      params.set('sort',   s.sort);
      const qs = params.toString();
      backLink.href = qs ? `index.html?${qs}` : 'index.html';
      backLink.textContent = '← Back to results';
    } catch { /* leave default href */ }
  }
}

// ── Init ─────────────────────────────────────────────────────
const rawId = new URLSearchParams(window.location.search).get('id');

if (!rawId || !/^\d+$/.test(rawId)) {
  container.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'status-msg';
  p.textContent = 'No valid movie selected. Please go back and choose a movie.';
  container.appendChild(p);
} else {
  renderDetail(rawId);
}
