import axios from 'axios';

import { useSettingsStore } from '/@/renderer/store';
import { logger } from '/@/renderer/utils/logger';
import {
    InternetProviderLyricResponse,
    InternetProviderLyricSearchResponse,
    LyricGetQuery,
    LyricSearchQuery,
    LyricSource,
    QueueSong,
} from '/@/shared/types/domain-types';
import { orderSearchResults } from '/@/shared/utils/order-search-results';

const LRCLIB_FETCH_URL = 'https://lrclib.net/api/get';
const LRCLIB_SEARCH_URL = 'https://lrclib.net/api/search';

const TIMEOUT_MS = 5000;

type GetFetcher = (id: string) => Promise<null | string>;

type SearchFetcher = (
    params: LyricSearchQuery,
) => Promise<InternetProviderLyricSearchResponse[] | null>;

const searchLrcLib: SearchFetcher = async (params) => {
    if (!params.name && !params.artist) return null;

    const result = await axios
        .get<
            Array<{
                artistName: string;
                id: number;
                name: string;
                plainLyrics: null | string;
                syncedLyrics: null | string;
            }>
        >(LRCLIB_SEARCH_URL, {
            params: { q: [params.name, params.artist].join(' ').trim() },
            timeout: TIMEOUT_MS,
        })
        .catch((e) => {
            logger.error('LrcLib search request got an error!', (e as Error)?.message);
            return null;
        });

    if (!result?.data) return null;

    return orderSearchResults({
        params,
        results: result.data.map((song) => ({
            artist: song.artistName,
            id: String(song.id),
            isSync: song.syncedLyrics ? true : false,
            name: song.name,
            source: LyricSource.LRCLIB,
        })),
    });
};

const getLrcLibLyrics: GetFetcher = async (songId) => {
    const result = await axios
        .get<{
            plainLyrics: null | string;
            syncedLyrics: null | string;
        }>(`${LRCLIB_FETCH_URL}/${songId}`, { timeout: TIMEOUT_MS })
        .catch((e) => {
            logger.error('LrcLib lyrics request got an error!', (e as Error)?.message);
            return null;
        });

    return result?.data?.syncedLyrics || result?.data?.plainLyrics || null;
};

const SEARCH_FETCHERS: Partial<Record<LyricSource, SearchFetcher>> = {
    [LyricSource.LRCLIB]: searchLrcLib,
};

const GET_FETCHERS: Partial<Record<LyricSource, GetFetcher>> = {
    [LyricSource.LRCLIB]: getLrcLibLyrics,
};

const BROWSER_SOURCES = [LyricSource.LRCLIB];

const getEnabledSources = (): LyricSource[] => {
    const { sources } = useSettingsStore.getState().lyrics;
    return sources.filter((source) => BROWSER_SOURCES.includes(source));
};

const searchAllSources = async (
    params: LyricSearchQuery,
): Promise<InternetProviderLyricSearchResponse[]> => {
    const sources = getEnabledSources();

    const settled = await Promise.allSettled(
        sources.map((source) => SEARCH_FETCHERS[source]?.(params)),
    );

    const allSearchResults: InternetProviderLyricSearchResponse[] = [];
    settled.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
            allSearchResults.push(...result.value);
        } else if (result.status === 'rejected') {
            logger.error(`Error searching ${sources[index]} for lyrics:`, result.reason);
        }
    });
    return allSearchResults;
};

export const getRemoteLyricsBySong = async (
    song: QueueSong,
): Promise<InternetProviderLyricResponse | null> => {
    const params: LyricSearchQuery = {
        album: song.album || song.name,
        artist: song.artists[0].name,
        duration: song.duration / 1000.0,
        name: song.name,
    };

    const allSearchResults = await searchAllSources(params);

    if (allSearchResults.length === 0) {
        return null;
    }

    const bestMatch = orderSearchResults({ params, results: allSearchResults })[0];

    if (!bestMatch) {
        return null;
    }

    // Score is 0-1 where 0 = perfect match, 1 = worst match
    if ((bestMatch.score ?? 1) > 0.55) return null;

    try {
        const lyrics = await GET_FETCHERS[bestMatch.source]?.(bestMatch.id);
        if (lyrics) {
            return {
                artist: bestMatch.artist,
                id: bestMatch.id,
                lyrics,
                name: bestMatch.name,
                source: bestMatch.source,
            };
        }
    } catch (error) {
        logger.error(`Error fetching lyrics from ${bestMatch.source}:`, error);
    }

    return null;
};

export const searchRemoteLyrics = async (
    params: LyricSearchQuery,
): Promise<Record<LyricSource, InternetProviderLyricSearchResponse[]>> => {
    const allSearchResults = await searchAllSources(params);

    const results: Record<LyricSource, InternetProviderLyricSearchResponse[]> = {
        [LyricSource.GENIUS]: [],
        [LyricSource.LRCLIB]: [],
        [LyricSource.NETEASE]: [],
        [LyricSource.SIMPMUSIC]: [],
    };
    for (const item of allSearchResults) {
        results[item.source].push(item);
    }
    return results;
};

export const getRemoteLyricsByRemoteId = async (params: LyricGetQuery): Promise<null | string> => {
    const { remoteSongId, remoteSource } = params;
    const response = await GET_FETCHERS[remoteSource]?.(remoteSongId);
    return response ?? null;
};
