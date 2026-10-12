// js/api.js — all network calls; keys loaded from /data/config.json

const CONFIG_URL = '/data/config.json';
let cfg = null;

async function getConfig() {
  if (!cfg) {
    const res = await fetch(CONFIG_URL);
    if (!res.ok) throw new Error('Could not load app config.');
    cfg = await res.json();
  }
  return cfg;
}

/** Shared fetch wrapper — surfaces 429 and other HTTP errors clearly */
async function apiFetch(url) {
  const res = await fetch(url);
  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
}

/**
 * Search TMDB. Uses /search/movie for text queries, /discover/movie otherwise.
 * Returns { results, totalPages, totalResults, page }.
 */
export async function searchMovies({
  query = '', genre = '', minRating = '', decade = '',
  sort = 'popularity.desc', page = 1,
} = {}) {
  const { tmdbBaseUrl, tmdbApiKey } = await getConfig();

  const params = new URLSearchParams({
    api_key: tmdbApiKey,
    sort_by: sort,
    include_adult: false,
    page,
  });

  let endpoint;
  if (query) {
    endpoint = 'search/movie';
    params.set('query', query);
    // /search/movie ignores genre/rating/date — applied client-side in search.js
  } else {
    endpoint = 'discover/movie';
    if (genre)     params.set('with_genres', genre);
    if (minRating) params.set('vote_average.gte', minRating);
    if (decade) {
      params.set('primary_release_date.gte', `${decade}-01-01`);
      params.set('primary_release_date.lte', `${+decade + 9}-12-31`);
    }
  }

  const data = await apiFetch(`${tmdbBaseUrl}/${endpoint}?${params}`);
  return {
    results:      data.results      ?? [],
    totalPages:   data.total_pages  ?? 1,
    totalResults: data.total_results ?? 0,
    page:         data.page         ?? 1,
  };
}

/**
 * Fetch full TMDB movie details including external_ids.
 * Throws if movieId is not a valid positive integer.
 */
export async function getMovieDetails(movieId) {
  if (!movieId || !/^\d+$/.test(String(movieId))) {
    throw new Error('Invalid movie ID.');
  }
  const { tmdbBaseUrl, tmdbApiKey } = await getConfig();
  return apiFetch(
    `${tmdbBaseUrl}/movie/${movieId}?api_key=${tmdbApiKey}&append_to_response=external_ids`
  );
}

/**
 * Fetch OMDb data by IMDb ID.
 * Returns { imdbRating, rottenTomatoes, runtime, director, actors } or null.
 */
export async function getOmdbData(imdbId) {
  if (!imdbId) return null;
  const { omdbBaseUrl, omdbApiKey } = await getConfig();
  const data = await apiFetch(`${omdbBaseUrl}/?i=${imdbId}&apikey=${omdbApiKey}`).catch(() => null);
  if (!data || data.Response === 'False') return null;
  return {
    imdbRating:     data.imdbRating   ?? 'N/A',
    rottenTomatoes: data.Ratings?.find(r => r.Source === 'Rotten Tomatoes')?.Value ?? 'N/A',
    runtime:        data.Runtime      ?? 'N/A',
    director:       data.Director     ?? 'N/A',
    actors:         data.Actors       ?? 'N/A',
  };
}

/**
 * Convenience: fetch TMDB details then OMDb data via imdb_id.
 * OMDb failure is non-fatal — returns null for omdb.
 */
export async function fetchFullDetails(movieId) {
  const tmdb   = await getMovieDetails(movieId);
  const imdbId = tmdb.external_ids?.imdb_id ?? null;
  const omdb   = imdbId ? await getOmdbData(imdbId) : null;
  return { tmdb, omdb };
}

/** Resolve a TMDB poster_path to a full URL, or return a placeholder. */
export async function posterUrl(posterPath) {
  if (!posterPath) return 'https://placehold.co/342x513/162032/F4F4F0?text=No+Poster';
  const { tmdbImageBase } = await getConfig();
  return `${tmdbImageBase}${posterPath}`;
}

/*
 * ── Console test snippet ─────────────────────────────────────
 * Paste into DevTools console (while serving the app) to verify:
 *
 *   import('/js/api.js').then(async api => {
 *     const s = await api.searchMovies({ query: 'Inception' });
 *     console.log('search:', s.results[0]?.title, '| pages:', s.totalPages);
 *     const d = await api.getMovieDetails(s.results[0].id);
 *     console.log('details:', d.title, '| imdb_id:', d.external_ids?.imdb_id);
 *     const o = await api.getOmdbData(d.external_ids?.imdb_id);
 *     console.log('omdb:', o);
 *   });
 */
