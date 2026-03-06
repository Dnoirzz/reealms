export type ContentSource =
  | 'dramabox'
  | 'otakudesu'
  | 'komik'
  | 'netshort'
  | 'unknown'
  | (string & {});

export type JsonRecord = Record<string, unknown>;

export interface Episode {
  id: string;
  title: string;
  streamUrl: string;
  order: number;
  duration: string;
}

export interface Movie {
  id: string;
  title: string;
  posterUrl: string;
  synopsis: string;
  rating: number;
  year: string;
  sourceType: ContentSource;
  genres: string[];
  episodes: Episode[];
  totalChapters: number;
}

export function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
}

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(stringValue(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function addGenre(target: Set<string>, value: unknown) {
  const normalized = stringValue(value);
  if (normalized) {
    target.add(normalized);
  }
}

export function episodeFromJson(json: JsonRecord): Episode {
  let dramaboxUrl = '';

  const cdnList = Array.isArray(json.cdnList) ? json.cdnList : [];
  if (cdnList.length > 0 && isJsonRecord(cdnList[0])) {
    const videoPathList = Array.isArray(cdnList[0].videoPathList) ? cdnList[0].videoPathList : [];
    if (videoPathList.length > 0) {
      const preferredPath = videoPathList.find(
        (candidate) => isJsonRecord(candidate) && numberValue(candidate.quality) === 720,
      );
      const fallbackPath = preferredPath ?? videoPathList[0];
      if (isJsonRecord(fallbackPath)) {
        dramaboxUrl = stringValue(fallbackPath.videoPath);
      }
    }
  }

  const chapterIndex = numberValue(json.chapterIndex);

  return {
    id:
      stringValue(json.id) ||
      stringValue(json.vid) ||
      stringValue(json.episodeId) ||
      stringValue(json.chapterId),
    title: stringValue(json.title) || stringValue(json.chapterName) || 'Episode',
    streamUrl:
      stringValue(json.stream_url) ||
      stringValue(json.videoUrl) ||
      stringValue(json.main_url) ||
      dramaboxUrl,
    order:
      numberValue(json.order) ||
      numberValue(json.index) ||
      numberValue(json.episodeNo) ||
      (chapterIndex > 0 ? chapterIndex + 1 : 0),
    duration: stringValue(json.duration),
  };
}

export function movieFromJson(json: JsonRecord, sourceType: ContentSource): Movie {
  const genres = new Set<string>();

  if (Array.isArray(json.genres)) {
    for (const entry of json.genres) {
      addGenre(genres, entry);
    }
  } else {
    const rawGenres = stringValue(json.genres);
    if (rawGenres) {
      for (const token of rawGenres.split(',')) {
        addGenre(genres, token);
      }
    }
  }

  if (Array.isArray(json.tags)) {
    for (const entry of json.tags) {
      addGenre(genres, entry);
    }
  }

  if (Array.isArray(json.tagV3s)) {
    for (const entry of json.tagV3s) {
      if (!isJsonRecord(entry)) {
        continue;
      }

      addGenre(genres, entry.tagName);
      addGenre(genres, entry.tagEnName);
    }
  }

  const normalizedSource =
    stringValue(json.source_type) || stringValue(json.sourceType) || sourceType || 'unknown';

  return {
    id:
      stringValue(json.id) ||
      stringValue(json.bookId) ||
      stringValue(json.animeId) ||
      stringValue(json.manga_id) ||
      stringValue(json.movie_id) ||
      stringValue(json.video_id) ||
      stringValue(json.shortPlayId) ||
      stringValue(json.short_play_id),
    title:
      stringValue(json.title) ||
      stringValue(json.bookName) ||
      stringValue(json.name) ||
      stringValue(json.manga_name) ||
      stringValue(json.movie_name) ||
      stringValue(json.video_name) ||
      stringValue(json.shortPlayName) ||
      stringValue(json.short_play_name) ||
      'Unknown',
    posterUrl:
      stringValue(json.cover_image_url) ||
      stringValue(json.poster_url) ||
      stringValue(json.poster) ||
      stringValue(json.cover) ||
      stringValue(json.manga_cover) ||
      stringValue(json.movie_poster) ||
      stringValue(json.video_cover) ||
      stringValue(json.shortPlayCover) ||
      stringValue(json.short_play_cover) ||
      stringValue(json.thumb_url) ||
      stringValue(json.coverWap),
    synopsis:
      stringValue(json.synopsis) ||
      stringValue(json.introduction) ||
      stringValue(json.abstract) ||
      stringValue(json.manga_description) ||
      stringValue(json.description) ||
      stringValue(json.movie_description),
    rating: numberValue(json.rating),
    year: stringValue(json.year),
    sourceType: normalizedSource,
    genres: [...genres],
    episodes: [],
    totalChapters:
      numberValue(json.total_chapters) ||
      numberValue(json.chapterCount) ||
      numberValue(json.chapter_count),
  };
}

export function movieToJson(movie: Movie): JsonRecord {
  return {
    id: movie.id,
    title: movie.title,
    poster_url: movie.posterUrl,
    synopsis: movie.synopsis,
    rating: movie.rating,
    year: movie.year,
    source_type: movie.sourceType,
    genres: movie.genres,
    total_chapters: movie.totalChapters,
  };
}
