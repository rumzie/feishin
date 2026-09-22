import { createWithEqualityFn } from 'zustand/traditional';

interface PlayerbarWaveformStore {
    isLoading: boolean;
    progress: number;
    setLoading: (isLoading: boolean) => void;
    setProgress: (progress: number) => void;
}

export const usePlayerbarWaveformStore = createWithEqualityFn<PlayerbarWaveformStore>()((set) => ({
    isLoading: false,
    progress: 0,
    setLoading: (isLoading) => set({ isLoading }),
    setProgress: (progress) => set({ progress }),
}));

export const useIsPlayerbarWaveformLoading = () => usePlayerbarWaveformStore((s) => s.isLoading);

export const usePlayerbarWaveformProgress = () => usePlayerbarWaveformStore((s) => s.progress);

export const setPlayerbarWaveformLoading = (isLoading: boolean) =>
    usePlayerbarWaveformStore.getState().setLoading(isLoading);

export const setPlayerbarWaveformProgress = (progress: number) =>
    usePlayerbarWaveformStore.getState().setProgress(progress);

// In-memory cache of fetched waveform audio, keyed by stream URL, so repeat
// plays of the same track skip the download entirely.
const WAVEFORM_CACHE_LIMIT = 10;
const waveformCache = new Map<string, Blob>();

export const getWaveformCache = (streamUrl: string) => waveformCache.get(streamUrl);

export const setWaveformCache = (streamUrl: string, blob: Blob) => {
    waveformCache.set(streamUrl, blob);
    if (waveformCache.size > WAVEFORM_CACHE_LIMIT) {
        const oldestKey = waveformCache.keys().next().value;
        if (oldestKey !== undefined) {
            waveformCache.delete(oldestKey);
        }
    }
};

export const fetchWaveformAudio = async (
    streamUrl: string,
    onProgress?: (percent: number) => void,
) => {
    const response = await fetch(streamUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch waveform audio (${response.status})`);
    }

    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const total = Number(response.headers.get('content-length') || 0);
    if (!response.body || !total) {
        return new Blob([await response.arrayBuffer()], { type: contentType });
    }

    const chunks: Uint8Array[] = [];
    const reader = response.body.getReader();
    let received = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            chunks.push(value);
            received += value.length;
            onProgress?.(Math.round((received / total) * 100));
        }
    }

    return new Blob(chunks as BlobPart[], { type: contentType });
};
