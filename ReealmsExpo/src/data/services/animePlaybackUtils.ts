export type BloggerPlayableVariant = {
  url: string;
  itag: number;
};

const playableExtensions = ['.m3u8', '.mp4', '.m4v', '.webm', '.mov', '.mkv'];
const embedPathPattern = /\/(embed|player|preview|iframe)\//i;

function bloggerHeightForItag(itag: number) {
  switch (itag) {
    case 37:
      return 1080;
    case 22:
      return 720;
    case 59:
      return 480;
    case 18:
      return 360;
    default:
      return 0;
  }
}

export function normalizeAnimeExtractedUrl(rawValue: string, baseUrl: string) {
  let url = rawValue.trim();
  if (!url) {
    return '';
  }

  url = url
    .replace(/\\\//g, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003d/gi, '=')
    .replace(/\\u003f/gi, '?')
    .replace(/\\&/g, '&')
    .replace(/\\=/g, '=')
    .replace(/\\\?/g, '?')
    .replace(/&amp;/gi, '&')
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\\+$/g, '');

  if (!url || url.startsWith('blob:') || url.startsWith('javascript:')) {
    return '';
  }

  try {
    const absoluteUrl = new URL(url, baseUrl).toString();
    return absoluteUrl.startsWith('http://') || absoluteUrl.startsWith('https://') ? absoluteUrl : '';
  } catch {
    return '';
  }
}

export function isDirectPlayableVideoUrl(rawUrl: string) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return false;
  }

  const host = parsedUrl.hostname.toLowerCase();
  const path = parsedUrl.pathname.toLowerCase();

  if (host.includes('googlevideo.com') && path.includes('videoplayback')) {
    const mime = parsedUrl.searchParams.get('mime')?.toLowerCase() ?? '';
    return mime.startsWith('video/');
  }

  const hasPlayableExtension = playableExtensions.some((extension) => path.endsWith(extension));
  if (!hasPlayableExtension) {
    return false;
  }

  if (embedPathPattern.test(path)) {
    return false;
  }

  return true;
}

export function extractBloggerPlayableVariants(rawBody: string): BloggerPlayableVariant[] {
  if (!rawBody) {
    return [];
  }

  const normalized = rawBody
    .replace(/\\\//g, '/')
    .replace(/\\u003d/gi, '=')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003f/gi, '?')
    .replace(/\\=/g, '=')
    .replace(/\\&/g, '&')
    .replace(/\\\?/g, '?');
  const regex = /https:\/\/[^"\s]+googlevideo\.com\/videoplayback[^"\s]+/gi;

  const variants: BloggerPlayableVariant[] = [];
  const seen = new Set<string>();

  for (const match of normalized.matchAll(regex)) {
    const url = normalizeAnimeExtractedUrl(match[0] ?? '', 'https://www.blogger.com');
    if (!url || seen.has(url) || !isDirectPlayableVideoUrl(url)) {
      continue;
    }

    seen.add(url);
    let itag = 0;
    try {
      itag = Number(new URL(url).searchParams.get('itag') ?? '') || 0;
    } catch {
      itag = 0;
    }

    variants.push({ url, itag });
  }

  variants.sort((left, right) => {
    const rankDiff = bloggerHeightForItag(right.itag) - bloggerHeightForItag(left.itag);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    return left.url.length - right.url.length;
  });

  return variants;
}
