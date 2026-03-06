import type { Episode } from '../models/media';

const explicitEpisodePatterns = [
  /(?:^|[\s./_-])episode[\s:._/-]*(\d+)(?=$|[\s./_-])/i,
  /(?:^|[\s./_-])ep[\s:._/-]*(\d+)(?=$|[\s./_-])/i,
];

function stripHtml(rawTitle: string) {
  return rawTitle.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractOtakudesuEpisodeNumber(value: string) {
  for (const pattern of explicitEpisodePatterns) {
    const match = pattern.exec(value);
    if (match?.[1]) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  const numericMatches = [...value.matchAll(/(?<!\d)(\d+)(?!\d)/g)]
    .map((match) => Number(match[1]))
    .filter((entry) => Number.isFinite(entry) && entry > 0);

  return numericMatches.length > 0 ? numericMatches[numericMatches.length - 1] : 0;
}

export function buildOtakudesuEpisodeEntry(options: {
  rawTitle: string;
  url: string;
  fallbackOrder: number;
}): Episode {
  const { rawTitle, url, fallbackOrder } = options;
  const cleanedTitle = stripHtml(rawTitle);
  const titleEpisodeNumber = extractOtakudesuEpisodeNumber(cleanedTitle);
  const urlEpisodeNumber = extractOtakudesuEpisodeNumber(url);
  const resolvedEpisodeNumber = titleEpisodeNumber > 0 ? titleEpisodeNumber : urlEpisodeNumber;
  const order = resolvedEpisodeNumber > 0 ? resolvedEpisodeNumber : fallbackOrder;

  return {
    id: url,
    title: resolvedEpisodeNumber > 0 ? `Episode ${resolvedEpisodeNumber}` : cleanedTitle || `Episode ${fallbackOrder}`,
    streamUrl: '',
    order,
    duration: '',
  };
}
