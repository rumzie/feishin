import {
    InternetProviderLyricResponse,
    InternetProviderLyricSearchResponse,
    LyricSearchQuery,
    LyricSource,
} from '.';
import { store } from '../settings';

import log from '/@/main/logger';
import { getNeteaseLyrics, searchNeteaseLyrics } from '/@/shared/utils/netease-lyrics';

const BASE_URL = 'https://music.163.com';

// Adapted from https://github.com/NyaomiDEV/Sunamu/blob/master/src/main/lyricproviders/netease.ts

export async function getLyricsBySongId(songId: string): Promise<null | string> {
    return getNeteaseLyrics(songId, {
        baseUrl: BASE_URL,
        enableTranslation: store.get('enableNeteaseTranslation', false) as boolean,
        onError: (error) => log.error('NetEase lyrics request got an error!', error),
    });
}

export async function getSearchResults(
    params: LyricSearchQuery,
): Promise<InternetProviderLyricSearchResponse[] | null> {
    return searchNeteaseLyrics(params, {
        baseUrl: BASE_URL,
        onError: (error) => log.error('NetEase search request got an error!', error),
    });
}

export async function query(
    params: LyricSearchQuery,
): Promise<InternetProviderLyricResponse | null> {
    const lyricsMatch = await getMatchedLyrics(params);
    if (!lyricsMatch) {
        return null;
    }

    const lyrics = await getLyricsBySongId(lyricsMatch.id);
    if (!lyrics) {
        return null;
    }

    return {
        artist: lyricsMatch.artist,
        id: lyricsMatch.id,
        lyrics,
        name: lyricsMatch.name,
        source: LyricSource.NETEASE,
    };
}

async function getMatchedLyrics(
    params: LyricSearchQuery,
): Promise<null | Omit<InternetProviderLyricResponse, 'lyrics'>> {
    const results = await getSearchResults(params);

    const firstMatch = results?.[0];

    if (!firstMatch || (firstMatch?.score && firstMatch.score > 0.5)) {
        return null;
    }

    return firstMatch;
}
