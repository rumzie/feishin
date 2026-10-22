import axios from 'axios';

import {
    InternetProviderLyricSearchResponse,
    LyricSearchQuery,
    LyricSource,
} from '/@/shared/types/domain-types';
import { orderSearchResults } from '/@/shared/utils/order-search-results';

const SEARCH_PATH = 'api/search/get';
const LYRICS_PATH = 'api/song/lyric';

export interface NeteaseLyricsOptions {
    /** Base URL of the music.163.com API, or of a reverse proxy in front of it. */
    baseUrl: string;
    onError?: (error: unknown) => void;
    timeout?: number;
}

interface NeteaseArtist {
    name: string;
}

interface NeteaseLyricResponse {
    lrc?: { lyric?: string };
    tlyric?: { lyric?: string };
}

interface NeteaseSearchResponse {
    result?: {
        songs?: NeteaseSong[];
    };
}

interface NeteaseSong {
    artists?: NeteaseArtist[];
    id: number;
    name: string;
}

const buildUrl = (baseUrl: string, path: string) => `${baseUrl.replace(/\/+$/, '')}/${path}`;

export async function getNeteaseLyrics(
    songId: string,
    options: NeteaseLyricsOptions & { enableTranslation: boolean },
): Promise<null | string> {
    let data: NeteaseLyricResponse;

    try {
        const result = await axios.get<NeteaseLyricResponse>(
            buildUrl(options.baseUrl, LYRICS_PATH),
            {
                params: {
                    id: songId,
                    kv: '-1',
                    lv: '-1',
                    tv: '-1',
                },
                timeout: options.timeout,
            },
        );
        data = result.data;
    } catch (error) {
        options.onError?.(error);
        return null;
    }

    const originalLrc = data?.lrc?.lyric;

    if (!options.enableTranslation) {
        return originalLrc || null;
    }

    return mergeNeteaseLyrics(originalLrc, data?.tlyric?.lyric);
}

export function mergeNeteaseLyrics(
    original: string | undefined,
    translated: string | undefined,
): null | string {
    if (!original) {
        return null;
    }
    if (!translated) {
        return original;
    }

    const lrcLineRegex = /\[(\d{2}:\d{2}\.\d{2,3})\](.*)/;
    const translatedMap = new Map<string, string>();

    // Parse the translated LRC and store it in a Map for efficient timestamp-based lookups.
    translated.split('\n').forEach((line) => {
        const match = line.match(lrcLineRegex);
        if (match) {
            const timestamp = match[1];
            const text = match[2].trim();
            if (text) {
                translatedMap.set(timestamp, text);
            }
        }
    });

    if (translatedMap.size === 0) {
        return original;
    }

    // Iterate through each line of the original LRC. If a translation exists for the same timestamp, append the translated text after the original text.
    const finalLines = original.split('\n').map((line) => {
        const match = line.match(lrcLineRegex);

        if (match) {
            const timestamp = match[1];
            const originalText = match[2].trim();
            const translatedText = translatedMap.get(timestamp);

            if (translatedText && originalText) {
                // Append and add a break delimiter to separate the original and translated text
                return [`[${timestamp}]${originalText}`, translatedText].join('_BREAK_');
            }
        }

        // If no match or no translation is found, return the original line unchanged.
        return line;
    });

    return finalLines.join('\n');
}

export async function searchNeteaseLyrics(
    params: LyricSearchQuery,
    options: NeteaseLyricsOptions,
): Promise<InternetProviderLyricSearchResponse[] | null> {
    const searchQuery = [params.artist, params.name].join(' ').trim();

    if (!searchQuery) {
        return null;
    }

    let data: NeteaseSearchResponse;

    try {
        const result = await axios.get<NeteaseSearchResponse>(
            buildUrl(options.baseUrl, SEARCH_PATH),
            {
                params: {
                    limit: 5,
                    offset: 0,
                    s: searchQuery,
                    type: '1',
                },
                timeout: options.timeout,
            },
        );
        data = result.data;
    } catch (error) {
        options.onError?.(error);
        return null;
    }

    const songs = data?.result?.songs;

    if (!songs) return null;

    return orderSearchResults({
        params,
        results: songs.map((song) => ({
            artist: song.artists ? song.artists.map((artist) => artist.name).join(', ') : '',
            id: String(song.id),
            isSync: null,
            name: song.name,
            source: LyricSource.NETEASE,
        })),
    });
}
