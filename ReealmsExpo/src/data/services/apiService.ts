import { appConstants } from '../../core/constants';
import {
  episodeFromJson,
  isJsonRecord,
  movieFromJson,
  type ContentSource,
  type Episode,
  type JsonRecord,
  type Movie,
} from '../models/media';
import type {
  AnimePlaybackManifest,
  DeferredPlaybackQualityOption,
  DirectPlaybackQualityOption,
  OtakudesuMirrorReference,
  PlaybackQualityOption,
  ResolvedPlayableSource,
} from '../models/playback';
import {
  extractBloggerPlayableVariants,
  isDirectPlayableVideoUrl as isDirectPlayableVideoUrlValue,
  normalizeAnimeExtractedUrl,
  type BloggerPlayableVariant,
} from './animePlaybackUtils';
import { buildOtakudesuEpisodeEntry } from './animeEpisodeUtils';
import { mergeAnimeQualityOptions, parseOtakudesuQualitySections } from './otakudesuQualityUtils';

type RequestOptions = {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
};

type CachedSearchResult = {
  at: number;
  data: Movie[];
};

type OtakudesuMirrorCandidate = {
  provider: string;
  href: string;
  dataContent: string;
};

const defaultHeaders = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

function arrayFromUnknown(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstListCandidate(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isJsonRecord(payload)) {
    return [];
  }

  for (const key of keys) {
    const next = payload[key];
    if (Array.isArray(next)) {
      return next;
    }
  }

  return [];
}

function episodeNumberFromLabel(label: string): number {
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export class ApiService {
  private source: ContentSource = 'dramabox';
  private readonly dramaboxSearchCache = new Map<string, CachedSearchResult>();
  private dramaboxRateLimitedUntil: number | null = null;
  private readonly safeAnimeMirrorKeywords = [
    'desustream',
    'vidhide',
    'odvidhide',
    'filemoon',
    'filedon',
    'desudrive',
    'ondesu',
    'mp4upload',
    'streamwish',
    'vidsrc',
    'mega.nz',
    'stream',
    'embed',
    'cloudflarestorage.com',
  ];
  private readonly blockedAnimeHostKeywords = [
    'qq',
    '1xbet',
    'adsterra',
    'doubleclick',
    'popads',
    'shorte',
    'ouo',
    'judi',
    'casino',
    'slot',
    'togel',
    'toto',
    'bet',
  ];

  setSource(source: ContentSource) {
    this.source = source.toLowerCase() as ContentSource;
  }

  async getHomeContent() {
    switch (this.source) {
      case 'dramabox':
        return this.getDramaboxContent('foryou');
      case 'komik':
        return this.getKomikContent();
      case 'otakudesu':
        return this.getAnimeContent();
      default:
        return [];
    }
  }

  async search(query: string) {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    switch (this.source) {
      case 'dramabox':
        return this.searchDramabox(trimmed);
      case 'komik':
        return this.searchKomik(trimmed);
      case 'otakudesu':
        return this.searchAnime(trimmed);
      default:
        return [];
    }
  }

  async getEpisodes(movieId: string): Promise<Episode[]> {
    switch (this.source) {
      case 'dramabox':
        return this.getDramaboxEpisodes(movieId);
      case 'komik':
        return this.getKomikChapters(movieId);
      case 'otakudesu':
        return this.getAnimeEpisodes(movieId);
      default:
        return [];
    }
  }

  async getComicImages(chapterId: string) {
    const payload = await this.requestJson<JsonRecord>(
      `${appConstants.komikBaseUrl}/komik/getimage?chapter_id=${encodeURIComponent(chapterId)}`,
    );
    const data = isJsonRecord(payload.data) ? payload.data : null;
    const chapter = data && isJsonRecord(data.chapter) ? data.chapter : null;
    const imageData = chapter ? chapter.data : null;
    return arrayFromUnknown(imageData).filter((entry): entry is string => typeof entry === 'string');
  }

  async scrapeOtakudesuEpisodes(animePageUrl: string): Promise<Episode[]> {
    if (!animePageUrl || !animePageUrl.startsWith('http')) {
      return [];
    }

    try {
      const html = await this.requestText(animePageUrl, { timeoutMs: 10000 });
      const regex = /href="(https?:\/\/otakudesu\.[^/"']+\/episode\/([^"']+)\/)"[^>]*>(.*?)<\/a>/gis;
      const matches = [...html.matchAll(regex)];
      if (matches.length === 0) {
        return [];
      }

      const seen = new Set<string>();
      const episodes: Episode[] = [];
      let fallbackOrder = 1;

      for (const match of matches) {
        const url = match[1] ?? '';
        if (!url || seen.has(url)) {
          continue;
        }

        seen.add(url);
        episodes.push(
          buildOtakudesuEpisodeEntry({
            rawTitle: match[3] ?? '',
            url,
            fallbackOrder,
          }),
        );
        fallbackOrder += 1;
      }

      episodes.sort((left, right) => left.order - right.order);
      return episodes;
    } catch (error) {
      console.warn('Otakudesu episode scrape failed:', error);
      return [];
    }
  }

  isDirectPlayableVideoUrl(rawUrl: string) {
    return isDirectPlayableVideoUrlValue(rawUrl);
  }

  async getAnimeStreamUrl(episodeSlug: string) {
    if (!episodeSlug) {
      return '';
    }

    try {
      const payload = await this.requestJson<JsonRecord>(
        `${appConstants.animeBaseUrl}/episode/${encodeURIComponent(episodeSlug)}`,
        { retries: 3, timeoutMs: 8000 },
      );

      const data = isJsonRecord(payload.data) ? payload.data : null;
      const details = data && isJsonRecord(data.details) ? data.details : null;
      const candidates = [
        details?.defaultStreamingUrl,
        payload.details && isJsonRecord(payload.details) ? payload.details.defaultStreamingUrl : null,
        data?.defaultStreamingUrl,
        payload.defaultStreamingUrl,
        data?.embed_url,
        data?.stream_url,
        data?.url,
        payload.embed_url,
        payload.stream_url,
        payload.url,
      ];

      for (const candidate of candidates) {
        const streamUrl = typeof candidate === 'string' ? candidate.trim() : '';
        if (streamUrl.startsWith('http') && !this.isBlockedAnimeUrl(streamUrl)) {
          return streamUrl;
        }
      }
    } catch (error) {
      console.warn('Anime stream lookup failed:', error);
    }

    return '';
  }

  async getBestOtakudesuStreamUrl(episodeUrlOrSlug: string) {
    if (!episodeUrlOrSlug) {
      return '';
    }

    if (!episodeUrlOrSlug.startsWith('http')) {
      return this.getAnimeStreamUrl(episodeUrlOrSlug);
    }

    const rankedMirrors = await this.collectOtakudesuMirrorCandidates(episodeUrlOrSlug);
    if (rankedMirrors.length > 0) {
      return rankedMirrors[0];
    }

    const slug = this.extractEpisodeSlugFromUrl(episodeUrlOrSlug);
    if (!slug) {
      return '';
    }

    const directApiUrl = await this.getAnimeStreamUrl(slug);
    if (directApiUrl && !this.isBlockedAnimeUrl(directApiUrl)) {
      return directApiUrl;
    }

    return '';
  }

  async getBestOtakudesuPlayableSource(episodeUrlOrSlug: string): Promise<ResolvedPlayableSource | null> {
    if (!episodeUrlOrSlug) {
      return null;
    }

    let streamUrl = '';

    if (episodeUrlOrSlug.startsWith('http')) {
      const rankedMirrors = await this.collectOtakudesuMirrorCandidates(episodeUrlOrSlug);
      for (const mirrorUrl of rankedMirrors) {
        const source = await this.resolvePlayableSourceFromPage(mirrorUrl);
        if (source?.url) {
          return source;
        }
      }

      if (rankedMirrors.length > 0) {
        streamUrl = rankedMirrors[0];
      }

      if (!streamUrl) {
        streamUrl = await this.getBestOtakudesuStreamUrl(episodeUrlOrSlug);
      }
    } else {
      streamUrl = await this.getAnimeStreamUrl(episodeUrlOrSlug);
    }

    if (!streamUrl) {
      return null;
    }

    if (this.isDirectPlayableVideoUrl(streamUrl)) {
      return {
        url: streamUrl,
        qualityOptions: [],
      };
    }

    const directFromPage = await this.resolvePlayableSourceFromPage(streamUrl);
    if (directFromPage?.url) {
      return directFromPage;
    }

    return null;
  }

  async getOtakudesuPlaybackManifest(episodeUrlOrSlug: string): Promise<AnimePlaybackManifest | null> {
    if (!episodeUrlOrSlug) {
      return null;
    }

    const fallbackOptions = episodeUrlOrSlug.startsWith('http')
      ? await this.getOtakudesuFallbackQualityOptions(episodeUrlOrSlug)
      : [];
    const directSource = await this.getBestOtakudesuPlayableSource(episodeUrlOrSlug);

    if (!directSource?.url && fallbackOptions.length === 0) {
      return null;
    }

    const initialUrl = directSource?.url ?? '';
    return {
      initialUrl,
      qualityOptions: mergeAnimeQualityOptions({
        initialUrl,
        directOptions: this.buildManifestDirectQualityOptions(directSource),
        fallbackOptions,
      }),
    };
  }

  async resolveOtakudesuQualityOption(option: PlaybackQualityOption): Promise<ResolvedPlayableSource | null> {
    if (option.mode === 'direct') {
      return {
        url: option.url,
        qualityOptions: [option],
      };
    }

    return this.resolveDeferredOtakudesuQuality(option);
  }

  generateEpisodesForAnime(animeSlug: string, count: number): Episode[] {
    if (count <= 0) {
      return [];
    }

    const base = animeSlug.replace(/-sub-indo$/, '');
    return Array.from({ length: count }, (_, index) => {
      const episodeNumber = index + 1;
      return {
        id: `${base}-episode-${episodeNumber}-sub-indo`,
        title: `Episode ${episodeNumber}`,
        order: episodeNumber,
        streamUrl: '',
        duration: '',
      };
    }).reverse();
  }

  private async requestJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const { timeoutMs = 10000, retries = 1, headers = {} } = options;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          headers: { ...defaultHeaders, ...headers },
          signal: controller.signal,
        });
        const rawBody = await response.text();

        if (!response.ok) {
          const preview = rawBody.slice(0, 160);
          const error = new Error(`Request failed (${response.status}) for ${url}: ${preview}`);
          Object.assign(error, { status: response.status });
          throw error;
        }

        return (rawBody ? JSON.parse(rawBody) : {}) as T;
      } catch (error) {
        lastError = error;
        const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 0;
        const shouldRetry = attempt < retries && (status === 429 || status >= 500 || status === 0);
        if (!shouldRetry) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`Request failed for ${url}`);
  }

  private async requestText(url: string, options: RequestOptions = {}) {
    const { timeoutMs = 10000, retries = 1, headers = {} } = options;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          headers: { ...defaultHeaders, ...headers },
          signal: controller.signal,
        });

        const body = await response.text();
        if (!response.ok) {
          const error = new Error(`Request failed (${response.status}) for ${url}: ${body.slice(0, 160)}`);
          Object.assign(error, { status: response.status });
          throw error;
        }

        return body;
      } catch (error) {
        lastError = error;
        const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 0;
        const shouldRetry = attempt < retries && (status === 429 || status >= 500 || status === 0);
        if (!shouldRetry) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`Request failed for ${url}`);
  }

  private extractQualityHint(rawUrl: string) {
    const normalized = rawUrl.toLowerCase();

    try {
      const parsedUrl = new URL(rawUrl);
      const itag = Number(parsedUrl.searchParams.get('itag') ?? '');
      const itagHeight = this.bloggerHeightForItag(Number.isFinite(itag) ? itag : 0);
      if (itagHeight > 0) {
        return itagHeight;
      }
    } catch {
      // Ignore malformed quality hints.
    }

    for (const value of [2160, 1440, 1080, 720, 540, 480, 360, 240]) {
      if (normalized.includes(`${value}p`) || normalized.includes(String(value))) {
        return value;
      }
    }

    if (normalized.includes('hd')) {
      return 720;
    }

    return 0;
  }

  private directPlayableScore(rawUrl: string) {
    const normalized = rawUrl.toLowerCase();
    const quality = this.extractQualityHint(normalized);
    const isM3u8 = normalized.includes('.m3u8');
    const isMp4 = normalized.includes('.mp4');
    return (quality * 100) + (isM3u8 ? 10 : 0) + (isMp4 ? 1 : 0);
  }

  private bloggerHeightForItag(itag: number) {
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

  private pickLikelyMasterM3u8Candidate(m3u8Candidates: string[]) {
    if (m3u8Candidates.length === 0) {
      return '';
    }

    function masterHintScore(url: string) {
      const normalized = url.toLowerCase();
      if (
        normalized.includes('master.m3u8') ||
        normalized.includes('/master') ||
        normalized.includes('type=master') ||
        normalized.includes('playlist.m3u8')
      ) {
        return 0;
      }

      if (normalized.includes('m3u8') && !normalized.match(/\d{3,4}p/)) {
        return 1;
      }

      return 2;
    }

    return [...m3u8Candidates].sort((left, right) => {
      const scoreDiff = masterHintScore(left) - masterHintScore(right);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      const qualityDiff = this.extractQualityHint(left) - this.extractQualityHint(right);
      if (qualityDiff !== 0) {
        return qualityDiff;
      }

      return left.length - right.length;
    })[0];
  }

  private isMasterM3u8Content(body: string) {
    return body.includes('#EXT-X-STREAM-INF');
  }

  private async isMasterM3u8Url(playlistUrl: string) {
    try {
      const parsedUrl = new URL(playlistUrl);
      if (!parsedUrl.pathname.toLowerCase().endsWith('.m3u8')) {
        return false;
      }

      const body = await this.requestText(playlistUrl, { timeoutMs: 8000 });
      return this.isMasterM3u8Content(body);
    } catch {
      return false;
    }
  }

  private normalizeExtractedUrl(rawValue: string, baseUrl: string) {
    return normalizeAnimeExtractedUrl(rawValue, baseUrl);
  }

  private decodeHtmlEntities(value: string) {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&#39;/g, '\'')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  private isUrlTokenBoundaryChar(character: string) {
    return ['"', '\'', ' ', '\n', '\r', '\t', '<', '>'].includes(character);
  }

  private extractDirectPlayableUrlFromUnknown(node: unknown, baseUrl: string): string {
    if (typeof node === 'string') {
      const normalized = this.normalizeExtractedUrl(node, baseUrl);
      if (
        normalized &&
        !this.isBlockedAnimeUrl(normalized) &&
        this.isDirectPlayableVideoUrl(normalized)
      ) {
        return normalized;
      }

      return '';
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const extracted = this.extractDirectPlayableUrlFromUnknown(item, baseUrl);
        if (extracted) {
          return extracted;
        }
      }

      return '';
    }

    if (isJsonRecord(node)) {
      for (const value of Object.values(node)) {
        const extracted = this.extractDirectPlayableUrlFromUnknown(value, baseUrl);
        if (extracted) {
          return extracted;
        }
      }
    }

    return '';
  }

  private buildManifestDirectQualityOptions(
    source: ResolvedPlayableSource | null,
  ): DirectPlaybackQualityOption[] {
    if (!source?.url) {
      return [];
    }

    const options = [...source.qualityOptions];
    if (!options.some((option) => option.url === source.url)) {
      const rank = this.extractQualityHint(source.url);
      const label = rank > 0 ? `${rank}p` : 'Direct';
      options.push(this.buildDirectQualityOption(label, source.url, rank));
    }

    const uniqueByLabel = new Map<string, DirectPlaybackQualityOption>();
    for (const option of options) {
      const existing = uniqueByLabel.get(option.label);
      if (!existing || option.rank > existing.rank) {
        uniqueByLabel.set(option.label, option);
      }
    }

    return [...uniqueByLabel.values()].sort((left, right) => right.rank - left.rank);
  }

  private createOtakudesuAbsoluteUrlResolver(episodeUrl: string) {
    const episodeUri = new URL(episodeUrl);
    return (url: string) => {
      if (url.startsWith('http')) {
        return url;
      }
      if (url.startsWith('//')) {
        return `https:${url}`;
      }
      if (url.startsWith('?')) {
        return `${episodeUrl.split('?')[0]}${url}`;
      }
      if (url.startsWith('/')) {
        return `${episodeUri.protocol}//${episodeUri.host}${url}`;
      }
      return url;
    };
  }

  private async getOtakudesuFallbackQualityOptions(episodeUrl: string): Promise<DeferredPlaybackQualityOption[]> {
    if (!episodeUrl.startsWith('http')) {
      return [];
    }

    try {
      const html = await this.requestText(episodeUrl, { timeoutMs: 10000 });
      return parseOtakudesuQualitySections(html, episodeUrl);
    } catch (error) {
      console.warn('Otakudesu fallback quality parsing failed:', error);
      return [];
    }
  }

  private preferResolvedSourceForLabel(
    source: ResolvedPlayableSource,
    preferredLabel: string,
  ): ResolvedPlayableSource {
    const preferredOption = source.qualityOptions.find((option) => option.label === preferredLabel);
    if (!preferredOption) {
      return source;
    }

    return {
      url: preferredOption.url,
      qualityOptions: source.qualityOptions,
    };
  }

  private async resolveDeferredOtakudesuQuality(
    option: DeferredPlaybackQualityOption,
  ): Promise<ResolvedPlayableSource | null> {
    if (!option.episodeUrl || !option.episodeUrl.startsWith('http')) {
      return null;
    }

    try {
      const html = await this.requestText(option.episodeUrl, { timeoutMs: 10000 });
      const episodeUri = new URL(option.episodeUrl);
      const makeAbsolute = this.createOtakudesuAbsoluteUrlResolver(option.episodeUrl);
      const ajaxUrl = `${episodeUri.protocol}//${episodeUri.host}/wp-admin/admin-ajax.php`;
      const nonceAction = this.extractOtakudesuNonceAction(html);
      const mirrorAction = this.extractOtakudesuMirrorAction(html);
      let nonce = '';

      for (const mirror of option.mirrors) {
        if (mirror.href && mirror.href !== '#') {
          const resolvedHref = makeAbsolute(mirror.href);
          if (this.isSafeAnimeMirrorUrl(resolvedHref)) {
            const source = await this.resolvePlayableSourceFromPage(resolvedHref);
            if (source?.url) {
              return this.preferResolvedSourceForLabel(source, option.label);
            }
          }
        }

        if (mirror.dataContent) {
          nonce ||= await this.fetchOtakudesuNonce(ajaxUrl, nonceAction);
          if (!nonce) {
            continue;
          }

          const mirrorUrl = await this.resolveOtakudesuAjaxMirrorUrl({
            ajaxUrl,
            dataContent: mirror.dataContent,
            nonce,
            mirrorAction,
            makeAbsolute,
          });
          if (!mirrorUrl) {
            continue;
          }

          const source = await this.resolvePlayableSourceFromPage(mirrorUrl);
          if (source?.url) {
            return this.preferResolvedSourceForLabel(source, option.label);
          }
        }
      }
    } catch (error) {
      console.warn('Deferred Otakudesu quality resolve failed:', error);
    }

    return null;
  }

  private buildDirectQualityOption(label: string, url: string, rank: number): DirectPlaybackQualityOption {
    return {
      label,
      rank,
      mode: 'direct',
      url,
    };
  }

  private buildBloggerQualityOption(variant: BloggerPlayableVariant, index: number): DirectPlaybackQualityOption {
    const height = this.bloggerHeightForItag(variant.itag);
    const label = height > 0 ? `${height}p` : `Variant ${index + 1}`;
    return this.buildDirectQualityOption(label, variant.url, height);
  }

  private extractBloggerPlayableVariants(rawBody: string): BloggerPlayableVariant[] {
    return extractBloggerPlayableVariants(rawBody);
  }

  private async resolveBloggerPlayableSource(pageUrl: string): Promise<ResolvedPlayableSource | null> {
    try {
      const pageUri = new URL(pageUrl);
      const token = pageUri.searchParams.get('token')?.trim() ?? '';
      if (!token) {
        return null;
      }

      const html = await this.requestText(pageUrl, { timeoutMs: 10000 });
      const fSid = /"FdrFJe":"([^"]+)"/.exec(html)?.[1] ?? '';
      const bl = /"cfb2h":"([^"]+)"/.exec(html)?.[1] ?? '';
      if (!fSid || !bl) {
        return null;
      }

      const args = JSON.stringify([token, '', 0]);
      const requestBody = JSON.stringify([[['WcwnYd', args, null, 'generic']]]);
      const batchUri = new URL('https://www.blogger.com/_/BloggerVideoPlayerUi/data/batchexecute');
      batchUri.search = new URLSearchParams({
        rpcids: 'WcwnYd',
        'source-path': '/video.g',
        'f.sid': fSid,
        bl,
        hl: 'en-US',
        _reqid: '60000',
        rt: 'c',
      }).toString();

      const response = await fetch(batchUri.toString(), {
        method: 'POST',
        headers: {
          ...defaultHeaders,
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: `f.req=${encodeURIComponent(requestBody)}&`,
      });

      if (!response.ok) {
        return null;
      }

      const variants = this.extractBloggerPlayableVariants(await response.text());
      if (variants.length === 0) {
        return null;
      }

      const qualityOptions: DirectPlaybackQualityOption[] = [];
      const seenLabels = new Set<string>();
      variants.forEach((variant, index) => {
        const option = this.buildBloggerQualityOption(variant, index);
        if (seenLabels.has(option.label)) {
          return;
        }

        seenLabels.add(option.label);
        qualityOptions.push(option);
      });

      if (qualityOptions.length === 0) {
        return null;
      }

      return {
        url: qualityOptions[0].url,
        qualityOptions,
      };
    } catch (error) {
      console.warn('Blogger playable source resolve failed:', error);
      return null;
    }
  }

  private async resolvePlayableSourceFromPage(
    pageUrl: string,
    depth = 0,
  ): Promise<ResolvedPlayableSource | null> {
    if (this.isDirectPlayableVideoUrl(pageUrl)) {
      return {
        url: pageUrl,
        qualityOptions: [],
      };
    }

    if (!pageUrl || !pageUrl.startsWith('http') || depth > 2) {
      return null;
    }

    try {
      const pageUri = new URL(pageUrl);
      const isBloggerPage =
        pageUri.hostname.toLowerCase().includes('blogger.com') &&
        pageUri.pathname.toLowerCase().includes('video.g');

      if (isBloggerPage) {
        return this.resolveBloggerPlayableSource(pageUrl);
      }

      const html = await this.requestText(pageUrl, { timeoutMs: 10000 });
      const candidates = new Set<string>();
      const iframeCandidates = new Set<string>();

      const collect = (regex: RegExp) => {
        for (const match of html.matchAll(regex)) {
          const raw = match[1] ?? '';
          const normalized = this.normalizeExtractedUrl(raw, pageUrl);
          if (normalized) {
            candidates.add(normalized);
          }
        }
      };

      collect(/(https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)/gi);
      collect(/(https?:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*)/gi);
      collect(/["']([^"']+\.m3u8[^"']*)["']/gi);
      collect(/["']([^"']+\.mp4[^"']*)["']/gi);

      for (const match of html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)) {
        const normalized = this.normalizeExtractedUrl(match[1] ?? '', pageUrl);
        if (normalized) {
          iframeCandidates.add(normalized);
        }
      }

      const decodedHtml = this.decodeHtmlEntities(html);
      if (decodedHtml !== html) {
        const lowered = decodedHtml.toLowerCase();
        for (const suffix of ['.m3u8', '.mp4', '.mkv', '.webm', '.mov']) {
          let start = 0;
          while (true) {
            const index = lowered.indexOf(suffix, start);
            if (index < 0) {
              break;
            }

            let left = index;
            while (left > 0 && !this.isUrlTokenBoundaryChar(decodedHtml[left - 1])) {
              left -= 1;
            }

            let right = index + suffix.length;
            while (right < decodedHtml.length && !this.isUrlTokenBoundaryChar(decodedHtml[right])) {
              right += 1;
            }

            const normalized = this.normalizeExtractedUrl(decodedHtml.slice(left, right).trim(), pageUrl);
            if (normalized) {
              candidates.add(normalized);
            }

            start = index + suffix.length;
          }
        }
      }

      const dataPageRaw = /data-page=["']([^"']+)["']/i.exec(html)?.[1] ?? '';
      if (dataPageRaw) {
        try {
          const decodedDataPage = this.decodeHtmlEntities(dataPageRaw)
            .replace(/\\"/g, '"')
            .replace(/\\\//g, '/');
          const extracted = this.extractDirectPlayableUrlFromUnknown(JSON.parse(decodedDataPage), pageUrl);
          if (extracted) {
            candidates.add(extracted);
          }
        } catch {
          // Ignore malformed embedded JSON payloads.
        }
      }

      const playableCandidates = [...candidates]
        .filter((url) => !this.isBlockedAnimeUrl(url))
        .filter((url) => this.isDirectPlayableVideoUrl(url))
        .sort((left, right) => this.directPlayableScore(right) - this.directPlayableScore(left));

      const m3u8Candidates = playableCandidates.filter((url) => url.toLowerCase().includes('.m3u8'));
      if (m3u8Candidates.length > 0) {
        for (const m3u8Url of m3u8Candidates) {
          if (await this.isMasterM3u8Url(m3u8Url)) {
            return {
              url: m3u8Url,
              qualityOptions: [],
            };
          }
        }

        const fallbackM3u8 = this.pickLikelyMasterM3u8Candidate(m3u8Candidates);
        if (fallbackM3u8) {
          return {
            url: fallbackM3u8,
            qualityOptions: [],
          };
        }
      }

      if (playableCandidates.length > 0) {
        return {
          url: playableCandidates[0],
          qualityOptions: [],
        };
      }

      if (depth < 2) {
        for (const iframeUrl of iframeCandidates) {
          if (this.isBlockedAnimeUrl(iframeUrl)) {
            continue;
          }

          let iframeUri: URL | null = null;
          try {
            iframeUri = new URL(iframeUrl);
          } catch {
            iframeUri = null;
          }

          const isNestedBlogger =
            iframeUri !== null &&
            iframeUri.hostname.toLowerCase().includes('blogger.com') &&
            iframeUri.pathname.toLowerCase().includes('video.g');

          if (!isNestedBlogger && !this.isSafeAnimeMirrorUrl(iframeUrl)) {
            continue;
          }

          const resolved = await this.resolvePlayableSourceFromPage(iframeUrl, depth + 1);
          if (resolved?.url) {
            return resolved;
          }
        }
      }
    } catch (error) {
      console.warn('Direct playable URL resolve failed:', error);
    }

    return null;
  }

  private parseOtakudesuAnime(item: unknown): Movie | null {
    if (!isJsonRecord(item)) {
      return null;
    }

    const currentEpisode = typeof item.current_episode === 'string' ? item.current_episode : '';
    const totalChapters = episodeNumberFromLabel(currentEpisode);
    const otakudesuUrl = typeof item.otakudesu_url === 'string' ? item.otakudesu_url : '';

    return {
      id: String(item.slug ?? ''),
      title: String(item.title ?? 'Unknown'),
      posterUrl: String(item.poster ?? ''),
      synopsis: otakudesuUrl,
      rating: Number(item.rating ?? 0),
      year: String(item.newest_release_date ?? ''),
      sourceType: 'otakudesu',
      genres: [],
      episodes: [],
      totalChapters,
    };
  }

  private isBlockedAnimeUrl(rawUrl: string) {
    try {
      const host = new URL(rawUrl).hostname.toLowerCase();
      return this.blockedAnimeHostKeywords.some((keyword) => host.includes(keyword));
    } catch {
      return false;
    }
  }

  private isSafeAnimeMirrorUrl(rawUrl: string) {
    try {
      const parsedUrl = new URL(rawUrl);
      const host = parsedUrl.hostname.toLowerCase();
      const path = parsedUrl.pathname.toLowerCase();
      if (!host || this.isBlockedAnimeUrl(rawUrl)) {
        return false;
      }

      if (['.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.webp'].some((suffix) => path.endsWith(suffix))) {
        return false;
      }

      return this.safeAnimeMirrorKeywords.some((keyword) => host.includes(keyword));
    } catch {
      return false;
    }
  }

  private extractHtmlAttribute(attrs: string, attrName: string) {
    const regex = new RegExp(`${attrName}\\s*=\\s*["']([^"']+)["']`, 'i');
    return regex.exec(attrs)?.[1]?.trim() ?? '';
  }

  private decodeBase64Loose(rawValue: string) {
    if (!rawValue) {
      return '';
    }

    let normalized = rawValue.trim().replace(/-/g, '+').replace(/_/g, '/');
    const mod = normalized.length % 4;
    if (mod !== 0) {
      normalized += '='.repeat(4 - mod);
    }

    try {
      const maybeBuffer = globalThis.Buffer;
      if (maybeBuffer) {
        return maybeBuffer.from(normalized, 'base64').toString('utf-8');
      }

      const binary = globalThis.atob(normalized);
      return decodeURIComponent(
        binary
          .split('')
          .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
          .join(''),
      );
    } catch {
      return '';
    }
  }

  private extractOtakudesuNonceAction(html: string) {
    return html.match(/data\s*:\s*\{\s*action\s*:\s*["']([a-f0-9]{32})["']\s*\}/i)?.[1]
      ?? 'aa1208d27f29ca340c92c66d1926f13f';
  }

  private extractOtakudesuMirrorAction(html: string) {
    return html.match(/nonce\s*:\s*(?:window\.__x__nonce|a)\s*,\s*action\s*:\s*["']([a-f0-9]{32})["']/i)?.[1]
      ?? '2a3505c93b0035d3f455df82bf976b84';
  }

  private async fetchOtakudesuNonce(ajaxUrl: string, nonceAction: string) {
    try {
      const response = await fetch(ajaxUrl, {
        method: 'POST',
        headers: {
          ...defaultHeaders,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: new URLSearchParams({ action: nonceAction }).toString(),
      });

      if (!response.ok) {
        return '';
      }

      const payload = (await response.json()) as unknown;
      if (isJsonRecord(payload)) {
        return String(payload.data ?? '').trim();
      }
    } catch (error) {
      console.warn('Otakudesu nonce fetch failed:', error);
    }

    return '';
  }

  private extractMirrorCandidatesFromQualitySection(html: string, sectionClass: string): OtakudesuMirrorCandidate[] {
    const sectionRegex = new RegExp(
      `<ul[^>]*class=["'][^"']*\\b${sectionClass}\\b[^"']*["'][^>]*>(.*?)</ul>`,
      'is',
    );
    const sectionHtml = sectionRegex.exec(html)?.[1];
    if (!sectionHtml) {
      return [];
    }

    const anchors = [...sectionHtml.matchAll(/<a([^>]*)>(.*?)<\/a>/gis)];
    return anchors
      .map((match) => {
        const attrs = match[1] ?? '';
        const inner = match[2] ?? '';
        return {
          provider: inner.replace(/<[^>]+>/g, ' ').trim().toLowerCase(),
          href: this.extractHtmlAttribute(attrs, 'href'),
          dataContent: this.extractHtmlAttribute(attrs, 'data-content'),
        };
      })
      .filter((entry) => entry.href || entry.dataContent);
  }

  private async resolveOtakudesuAjaxMirrorUrl(options: {
    ajaxUrl: string;
    dataContent: string;
    nonce: string;
    mirrorAction: string;
    makeAbsolute: (url: string) => string;
  }) {
    const { ajaxUrl, dataContent, nonce, mirrorAction, makeAbsolute } = options;
    if (!dataContent || !nonce) {
      return '';
    }

    try {
      const decodedPayload = this.decodeBase64Loose(dataContent);
      if (!decodedPayload) {
        return '';
      }

      const payload = JSON.parse(decodedPayload) as unknown;
      if (!isJsonRecord(payload)) {
        return '';
      }

      const body = new URLSearchParams();
      for (const [key, value] of Object.entries(payload)) {
        body.append(key, String(value));
      }
      body.set('nonce', nonce);
      body.set('action', mirrorAction);

      const response = await fetch(ajaxUrl, {
        method: 'POST',
        headers: {
          ...defaultHeaders,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        return '';
      }

      const jsonBody = (await response.json()) as unknown;
      if (!isJsonRecord(jsonBody)) {
        return '';
      }

      const mirrorHtml = this.decodeBase64Loose(String(jsonBody.data ?? ''));
      if (!mirrorHtml) {
        return '';
      }

      const iframeMatch = /<iframe[^>]+src=["']([^"']+)["']/i.exec(mirrorHtml);
      if (iframeMatch?.[1]) {
        const resolved = makeAbsolute(iframeMatch[1]);
        if (this.isSafeAnimeMirrorUrl(resolved)) {
          return resolved;
        }
      }

      for (const absoluteMatch of mirrorHtml.matchAll(/https?:\/\/[^"'\s<]+/gi)) {
        const candidate = makeAbsolute((absoluteMatch[0] ?? '').replace(/&amp;/g, '&').trim());
        if (this.isSafeAnimeMirrorUrl(candidate)) {
          return candidate;
        }
      }
    } catch (error) {
      console.warn('Otakudesu ajax mirror resolve failed:', error);
    }

    return '';
  }

  private async collectOtakudesuMirrorCandidates(episodeUrl: string) {
    if (!episodeUrl || !episodeUrl.startsWith('http')) {
      return [];
    }

    try {
      const html = await this.requestText(episodeUrl, { timeoutMs: 10000 });
      const episodeUri = new URL(episodeUrl);
      const makeAbsolute = (url: string) => {
        if (url.startsWith('http')) {
          return url;
        }
        if (url.startsWith('//')) {
          return `https:${url}`;
        }
        if (url.startsWith('?')) {
          return `${episodeUrl.split('?')[0]}${url}`;
        }
        if (url.startsWith('/')) {
          return `${episodeUri.protocol}//${episodeUri.host}${url}`;
        }
        return url;
      };

      const collected: string[] = [];
      const sectionCandidates = this.extractMirrorCandidatesFromQualitySection(html, 'm720p');
      if (sectionCandidates.length > 0) {
        const ajaxUrl = `${episodeUri.protocol}//${episodeUri.host}/wp-admin/admin-ajax.php`;
        const nonceAction = this.extractOtakudesuNonceAction(html);
        const mirrorAction = this.extractOtakudesuMirrorAction(html);
        let nonce = '';

        for (const candidate of sectionCandidates) {
          if (candidate.href && candidate.href !== '#') {
            const resolvedHref = makeAbsolute(candidate.href);
            if (this.isSafeAnimeMirrorUrl(resolvedHref)) {
              collected.push(resolvedHref);
            }
          }

          if (candidate.dataContent) {
            nonce ||= await this.fetchOtakudesuNonce(ajaxUrl, nonceAction);
            if (nonce) {
              const resolved = await this.resolveOtakudesuAjaxMirrorUrl({
                ajaxUrl,
                dataContent: candidate.dataContent,
                nonce,
                mirrorAction,
                makeAbsolute,
              });
              if (resolved) {
                collected.push(resolved);
              }
            }
          }
        }
      }

      for (const match of html.matchAll(/https?:\/\/[^"'\s<]+/gi)) {
        const candidate = (match[0] ?? '').replace(/&amp;/g, '&').trim();
        if (this.isSafeAnimeMirrorUrl(candidate)) {
          collected.push(candidate);
        }
      }

      const uniqueCandidates = [...new Set(collected.map((entry) => entry.trim()).filter(Boolean))];
      return uniqueCandidates.filter((entry) => this.isSafeAnimeMirrorUrl(entry));
    } catch (error) {
      console.warn('Otakudesu mirror collection failed:', error);
      return [];
    }
  }

  private extractEpisodeSlugFromUrl(episodeUrl: string) {
    try {
      const parsedUrl = new URL(episodeUrl);
      const segments = parsedUrl.pathname.split('/').filter(Boolean);
      const episodeIndex = segments.indexOf('episode');
      if (episodeIndex >= 0 && segments[episodeIndex + 1]) {
        return segments[episodeIndex + 1];
      }
      return segments.at(-1) ?? '';
    } catch {
      return '';
    }
  }

  private async getDramaboxContent(type: 'foryou' | 'latest') {
    const endpoints = [
      `${appConstants.dramaboxBaseUrl}/${type}?lang=in`,
      `${appConstants.dramaboxBaseUrl}/${type}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const payload = await this.requestJson<unknown>(endpoint);
        const items = firstListCandidate(payload, ['data', 'result', 'books', 'list']);
        if (items.length > 0) {
          return items.filter(isJsonRecord).map((item) => movieFromJson(item, 'dramabox'));
        }
      } catch (error) {
        console.warn('Dramabox home failed:', endpoint, error);
      }
    }

    return [];
  }

  private async getKomikContent() {
    try {
      const payload = await this.requestJson<JsonRecord>(
        `${appConstants.komikBaseUrl}/komik/latest?type=project`,
      );
      return arrayFromUnknown(payload.data).filter(isJsonRecord).map((item) => movieFromJson(item, 'komik'));
    } catch (error) {
      console.warn('Komik home failed:', error);
      return [];
    }
  }

  private async getAnimeContent() {
    try {
      const payload = await this.requestJson<JsonRecord>(
        `${appConstants.animeBaseUrl}/ongoing-anime`,
        { retries: 3, timeoutMs: 10000 },
      );
      return arrayFromUnknown(payload.data)
        .map((entry) => this.parseOtakudesuAnime(entry))
        .filter((entry): entry is Movie => entry !== null);
    } catch (error) {
      console.warn('Anime home failed:', error);
      return [];
    }
  }

  private async searchDramabox(query: string) {
    const cacheKey = query.toLowerCase();
    const now = Date.now();
    const cached = this.dramaboxSearchCache.get(cacheKey);

    if (cached && now - cached.at <= 2 * 60 * 1000) {
      return cached.data;
    }

    if (this.dramaboxRateLimitedUntil && now < this.dramaboxRateLimitedUntil) {
      return cached?.data ?? [];
    }

    const endpoints = [
      `${appConstants.dramaboxBaseUrl}/search?query=${encodeURIComponent(query)}&lang=in`,
      `${appConstants.dramaboxBaseUrl}/search?q=${encodeURIComponent(query)}&lang=in`,
    ];

    for (const endpoint of endpoints) {
      try {
        const payload = await this.requestJson<unknown>(endpoint);
        const items = firstListCandidate(payload, [
          'data',
          'result',
          'books',
          'list',
          'bookList',
          'shortPlayList',
          'items',
        ]);

        const movies = items.filter(isJsonRecord).map((item) => movieFromJson(item, 'dramabox'));
        this.dramaboxSearchCache.set(cacheKey, { at: Date.now(), data: movies });
        return movies;
      } catch (error) {
        const status =
          typeof error === 'object' && error && 'status' in error ? Number(error.status) : 0;
        if (status === 429) {
          this.dramaboxRateLimitedUntil = Date.now() + 65_000;
          return cached?.data ?? [];
        }
      }
    }

    return cached?.data ?? [];
  }

  private async searchKomik(query: string) {
    try {
      const payload = await this.requestJson<JsonRecord>(
        `${appConstants.komikBaseUrl}/komik/search?query=${encodeURIComponent(query)}`,
      );
      return arrayFromUnknown(payload.data).filter(isJsonRecord).map((item) => movieFromJson(item, 'komik'));
    } catch (error) {
      console.warn('Komik search failed:', error);
      return [];
    }
  }

  private async searchAnime(query: string) {
    try {
      const payload = await this.requestJson<JsonRecord>(
        `${appConstants.animeBaseUrl}/search/${encodeURIComponent(query)}`,
        { retries: 3, timeoutMs: 8000 },
      );
      return arrayFromUnknown(payload.data)
        .map((entry) => this.parseOtakudesuAnime(entry))
        .filter((entry): entry is Movie => entry !== null);
    } catch (error) {
      console.warn('Anime search failed:', error);
      return [];
    }
  }

  private async getDramaboxEpisodes(movieId: string) {
    try {
      const payload = await this.requestJson<unknown>(
        `${appConstants.dramaboxBaseUrl}/allepisode?bookId=${encodeURIComponent(movieId)}&lang=in`,
      );
      return arrayFromUnknown(payload).filter(isJsonRecord).map(episodeFromJson);
    } catch (error) {
      console.warn('Dramabox episodes failed:', error);
      return [];
    }
  }

  private async getKomikChapters(mangaId: string) {
    try {
      const payload = await this.requestJson<JsonRecord>(
        `${appConstants.komikBaseUrl}/komik/chapterlist?manga_id=${encodeURIComponent(mangaId)}`,
      );
      return arrayFromUnknown(payload.data)
        .filter(isJsonRecord)
        .map(episodeFromJson)
        .reverse();
    } catch (error) {
      console.warn('Komik chapters failed:', error);
      return [];
    }
  }

  private async getAnimeEpisodes(animeSlug: string) {
    try {
      const payload = await this.requestJson<JsonRecord>(
        `${appConstants.animeBaseUrl}/anime/${encodeURIComponent(animeSlug)}`,
        { retries: 3, timeoutMs: 6000 },
      );

      const detailData = isJsonRecord(payload.data) ? payload.data : null;
      const candidates = [
        detailData?.episode_list,
        detailData?.episodes,
        payload.episodeList,
      ];
      const episodeList = candidates.find(Array.isArray) ?? [];

      if (!Array.isArray(episodeList)) {
        return [];
      }

      return episodeList
        .filter(isJsonRecord)
        .map((entry, index) => ({
          id: String(entry.slug ?? entry.episode_id ?? entry.id ?? ''),
          title: String(entry.episode ?? entry.title ?? `Episode ${index + 1}`),
          streamUrl: '',
          order: index + 1,
          duration: '',
        }))
        .reverse();
    } catch (error) {
      console.warn('Anime episodes failed:', error);
      return [];
    }
  }
}
