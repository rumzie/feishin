import { useWavesurfer } from '@wavesurfer/react';
import formatDuration from 'format-duration';
import { del, get, set } from 'idb-keyval';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { CustomPlayerbarSlider } from './playerbar-slider';
import styles from './playerbar-waveform.module.css';

import { useSongUrl } from '/@/renderer/features/player/audio-player/hooks/use-stream-url';
import { PlayerbarSeekSlider } from '/@/renderer/features/player/components/playerbar-seek-slider';
import { usePlayer } from '/@/renderer/features/player/context/player-context';
import {
    BarAlign,
    usePlaybackSettings,
    usePlayerbarSlider,
    usePlayerSong,
    usePlayerTimestamp,
} from '/@/renderer/store';
import { useAppThemeColors, useColorScheme } from '/@/renderer/themes/use-app-theme';
import { Text } from '/@/shared/components/text/text';

// streams without Content-Length report "Infinity" until decoded; seeking then sets a NaN currentTime
const getFiniteDuration = (wavesurfer: { getDuration: () => number }) => {
    const duration = wavesurfer.getDuration();
    return Number.isFinite(duration) ? duration : 0;
};

type CachedWaveform = { duration: number; peaks: Array<number[]> };

// Decoding a second copy of the track (a fresh AudioContext + full decode)
// while the main player is running is what stalls weak/mobile devices, so
// cache the exported peaks per track and replay them without any network or
// decode on repeat views. 4096 points per channel comfortably beats the
// playerbar's pixel width at any DPR; the renderer downsamples to its grid.
// LRU of 100 tracks in memory, mirrored to IndexedDB (idb-keyval, like the
// player timestamp) so previously-waved tracks are instant across restarts.
// Keyed by `<serverId>:<id>` - the queue rebuilds tracks with a fresh nanoid
// `_uniqueId` every time, so that identity would never survive a restart.
const WAVEFORM_PEAK_LENGTH = 4096;
const WAVEFORM_CACHE_LIMIT = 100;
const WAVEFORM_DB_KEY_PREFIX = 'waveform-peaks:';
const WAVEFORM_DB_KEY_LIST = 'waveform-peaks-keys';
const waveformPeaksCache = new Map<string, CachedWaveform>();

const cacheWaveform = (key: string, entry: CachedWaveform) => {
    waveformPeaksCache.delete(key);
    if (waveformPeaksCache.size >= WAVEFORM_CACHE_LIMIT) {
        const oldest = waveformPeaksCache.keys().next().value as string | undefined;
        if (oldest) waveformPeaksCache.delete(oldest);
    }
    waveformPeaksCache.set(key, entry);
};

const loadWaveform = async (key: string) =>
    (await get<CachedWaveform | undefined>(WAVEFORM_DB_KEY_PREFIX + key)) ?? null;

const persistWaveform = async (key: string, entry: CachedWaveform) => {
    const keys = (await get<string[]>(WAVEFORM_DB_KEY_LIST)) ?? [];
    if (!keys.includes(key)) {
        keys.unshift(key);
        while (keys.length > WAVEFORM_CACHE_LIMIT) {
            const evicted = keys.pop();
            if (evicted) await del(WAVEFORM_DB_KEY_PREFIX + evicted);
        }
        await set(WAVEFORM_DB_KEY_LIST, keys);
    }
    await set(WAVEFORM_DB_KEY_PREFIX + key, entry);
};

export const PlayerbarWaveform = () => {
    const currentSong = usePlayerSong();
    const playerbarSlider = usePlayerbarSlider();
    const cacheKey = currentSong ? `${currentSong._serverId}:${currentSong.id}` : undefined;
    const currentTime = usePlayerTimestamp();
    const containerRef = useRef<HTMLDivElement>(null);
    const audioElementRef = useRef<HTMLAudioElement>(document.createElement('audio'));
    const { mediaSeekToTimestamp } = usePlayer();
    const [isLoading, setIsLoading] = useState(true);
    // 0-100 download progress from the wavesurfer `loading` event, rendered as a
    // fill bar while the track's peaks are being fetched/decoded for the first time
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [hasError, setHasError] = useState(false);
    // undefined: IndexedDB lookup not resolved yet; null: no persisted entry
    const [persisted, setPersisted] = useState<CachedWaveform | null | undefined>(undefined);
    const [isDragging, setIsDragging] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState<null | { x: number; y: number }>(null);
    const [tooltipValue, setTooltipValue] = useState(0);
    const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSeekValueRef = useRef<null | number>(null);
    const containerPositionRef = useRef<DOMRect | null>(null);

    const songDuration = currentSong?.duration ? currentSong.duration / 1000 : 0;

    const { transcode } = usePlaybackSettings();
    const streamUrl = useSongUrl(currentSong, true, {
        bitrate: 64,
        enabled: transcode.enabled,
        format: 'mp3',
    });

    const { color } = useAppThemeColors();
    const primaryColor = (color['--theme-colors-primary'] as string) || 'rgb(53, 116, 252)';

    const colorScheme = useColorScheme();

    const waveColor = useMemo(() => {
        return colorScheme === 'dark' ? 'rgba(96, 96, 96, 1)' : 'rgba(96, 96, 96, 1)';
    }, [colorScheme]);

    const cursorColor = useMemo(() => {
        return colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';
    }, [colorScheme]);

    const { wavesurfer } = useWavesurfer({
        barAlign:
            playerbarSlider?.barAlign === BarAlign.CENTER ? undefined : playerbarSlider?.barAlign,
        barGap: playerbarSlider?.barGap,
        barRadius: playerbarSlider?.barRadius,
        barWidth: playerbarSlider?.barWidth,
        container: containerRef,
        cursorColor,
        cursorWidth: 2,
        fillParent: true,
        height: 18,
        interact: false,
        media: audioElementRef.current,
        normalize: playerbarSlider?.stretched ?? false,
        progressColor: primaryColor,
        waveColor,
    });

    // Hydrate this track's peaks from IndexedDB. Keep the loading UI until the
    // read resolves (a few ms) so the network load never races it. Loaded
    // entries are promoted into the in-memory LRU for the rest of the session.
    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setLoadingProgress(0);
        setHasError(false);
        setPersisted(undefined);
        if (!cacheKey) {
            return;
        }

        loadWaveform(cacheKey).then((entry) => {
            if (cancelled) return;
            if (entry) {
                cacheWaveform(cacheKey as string, entry);
                setPersisted(entry);
            } else {
                setPersisted(null);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [cacheKey]);

    // Handle waveform ready state
    useEffect(() => {
        if (!wavesurfer) return;

        // Previously-decoded track: render from cached peaks instantly - no
        // second download, no second AudioContext decode while playing.
        const cached = cacheKey ? waveformPeaksCache.get(cacheKey) : undefined;
        if (cached && cached.duration > 0) {
            setIsLoading(false);
            setHasError(false);
            wavesurfer.load('', cached.peaks, cached.duration).catch(() => {
                setIsLoading(false);
                setHasError(true);
            });
            return;
        }

        // Wait for the IndexedDB lookup before deciding there is nothing to
        // replay, otherwise a few seconds of network+decode is wasted and then
        // cancelled when the persisted entry lands.
        if (persisted === undefined || !streamUrl) return;

        setIsLoading(true);
        setHasError(false);

        // The wavesurfer instance is shared across stream URLs, and this
        // effect subscribes before its (delayed) load actually starts. Guard
        // against events that do not belong to this effect's own load:
        // `cancelled` rejects events after the URL has moved on, and
        // `loadStarted` rejects a still-in-flight previous load's `ready`
        // (which would otherwise clear the loading state for the wrong
        // track and hide the seek bar over an empty/stale waveform).
        let cancelled = false;
        let loadStarted = false;

        const handleReady = () => {
            if (cancelled || !loadStarted) return;
            setIsLoading(false);
            setHasError(false);
            const mediaElement = wavesurfer.getMediaElement();
            if (mediaElement) {
                mediaElement.muted = true;
                mediaElement.volume = 0;
            }
            if (cacheKey && !waveformPeaksCache.has(cacheKey)) {
                try {
                    const duration = getFiniteDuration(wavesurfer);
                    if (duration > 0) {
                        const entry: CachedWaveform = {
                            duration,
                            peaks: wavesurfer.exportPeaks({
                                channels: 2,
                                maxLength: WAVEFORM_PEAK_LENGTH,
                                precision: 10000,
                            }),
                        };
                        cacheWaveform(cacheKey, entry);
                        persistWaveform(cacheKey, entry).catch(() => undefined);
                    }
                } catch {
                    // peaks not exportable (no decoded data) - just don't cache
                }
            }
        };

        // A load failure previously left the waveform canvas empty with no
        // seek control (the fallback slider only showed while loading), so
        // the progress bar disappeared until the app was restarted. Surface
        // real failures so the fallback slider is rendered again. AbortError
        // is the expected outcome of a superseded load and is ignored.
        const handleError = (error?: unknown) => {
            if (cancelled || !loadStarted) return;
            if (error instanceof Error && error.name === 'AbortError') return;
            setIsLoading(false);
            setHasError(true);
        };

        const handleLoading = (percent: number) => {
            setLoadingProgress(percent);
        };

        wavesurfer.on('ready', handleReady);
        wavesurfer.on('error', handleError);
        wavesurfer.on('loading', handleLoading);

        // `loadingDelay: 0` (the shipped default) means start immediately - only
        // a truthy value defers the fetch so quick track-skips never waste a
        // download. Loading is still wasted-work-safe: wavesurfer aborts the
        // previous fetch and this effect's `cancelled` flag drops the stale load.
        const waveformTimeout = setTimeout(
            () => {
                if (cancelled) return;
                loadStarted = true;
                wavesurfer.load(streamUrl).catch((error: unknown) => {
                    if (cancelled || (error instanceof Error && error.name === 'AbortError')) {
                        return;
                    }
                    setIsLoading(false);
                    setHasError(true);
                });
            },
            (playerbarSlider?.loadingDelay ?? 2) * 1000,
        );

        return () => {
            cancelled = true;
            wavesurfer.un('ready', handleReady);
            wavesurfer.un('error', handleError);
            wavesurfer.un('loading', handleLoading);
            clearTimeout(waveformTimeout);
        };
    }, [wavesurfer, streamUrl, cacheKey, persisted, playerbarSlider.loadingDelay]);

    useEffect(() => {
        if (!wavesurfer) return;

        // Ensure waveform never plays - it's just for visualization
        wavesurfer.setVolume(0);

        const muteMediaElement = () => {
            const mediaElement = wavesurfer.getMediaElement();
            if (mediaElement) {
                mediaElement.muted = true;
                mediaElement.volume = 0;
            }
        };

        muteMediaElement();

        const preventPlay = () => {
            wavesurfer.pause();
            muteMediaElement(); // Ensure it stays muted
        };

        wavesurfer.on('play', preventPlay);

        return () => {
            wavesurfer.un('play', preventPlay);
        };
    }, [wavesurfer]);

    // Handle drag start on waveform
    useEffect(() => {
        if (!wavesurfer || !songDuration || !containerRef.current) return;

        const container = containerRef.current;
        let isDraggingLocal = false;

        const handleMouseDown = (e: MouseEvent) => {
            if (!wavesurfer) return;
            const duration = getFiniteDuration(wavesurfer);
            if (duration <= 0) return;

            isDraggingLocal = true;
            setIsDragging(true);

            // Cancel any pending timeout
            if (seekTimeoutRef.current) {
                clearTimeout(seekTimeoutRef.current);
                seekTimeoutRef.current = null;
            }

            const rect = container.getBoundingClientRect();
            containerPositionRef.current = rect;
            const clickX = e.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, clickX / rect.width));
            const seekTime = ratio * duration;
            lastSeekValueRef.current = seekTime;
            setTooltipPosition({ x: rect.left + clickX, y: rect.top });
            setTooltipValue(seekTime);
            wavesurfer.seekTo(ratio);
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingLocal || !wavesurfer) return;

            const duration = getFiniteDuration(wavesurfer);
            if (duration <= 0) return;

            const rect = container.getBoundingClientRect();
            containerPositionRef.current = rect;
            const clickX = e.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, clickX / rect.width));
            const seekTime = ratio * duration;
            lastSeekValueRef.current = seekTime;
            setTooltipPosition({ x: rect.left + clickX, y: rect.top });
            setTooltipValue(seekTime);
            wavesurfer.seekTo(ratio);
        };

        const handleMouseUp = () => {
            if (!isDraggingLocal || !wavesurfer) return;

            isDraggingLocal = false;
            const duration = getFiniteDuration(wavesurfer);
            // The media element has no source for cached (peak-only) waveforms,
            // so read the intended position from the last pointer move instead
            // of wavesurfer.getCurrentTime() (always 0 without a source).
            const seekTime = lastSeekValueRef.current ?? wavesurfer.getCurrentTime();

            setTooltipPosition(null);

            if (duration > 0 && seekTime >= 0) {
                mediaSeekToTimestamp(seekTime);
                lastSeekValueRef.current = seekTime;

                // Set a fallback timeout to clear dragging state
                seekTimeoutRef.current = setTimeout(() => {
                    setIsDragging(false);
                    lastSeekValueRef.current = null;
                    seekTimeoutRef.current = null;
                }, 1000);
            } else {
                setIsDragging(false);
            }
        };

        // Handle touch events for mobile
        const handleTouchStart = (e: TouchEvent) => {
            if (!wavesurfer) return;
            const duration = getFiniteDuration(wavesurfer);
            if (duration <= 0) return;

            isDraggingLocal = true;
            setIsDragging(true);

            if (seekTimeoutRef.current) {
                clearTimeout(seekTimeoutRef.current);
                seekTimeoutRef.current = null;
            }

            const touch = e.touches[0];
            const rect = container.getBoundingClientRect();
            containerPositionRef.current = rect;
            const clickX = touch.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, clickX / rect.width));
            const seekTime = ratio * duration;
            lastSeekValueRef.current = seekTime;
            setTooltipPosition({ x: rect.left + clickX, y: rect.top });
            setTooltipValue(seekTime);
            wavesurfer.seekTo(ratio);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDraggingLocal || !wavesurfer) return;
            e.preventDefault();

            const duration = getFiniteDuration(wavesurfer);
            if (duration <= 0) return;

            const touch = e.touches[0];
            const rect = container.getBoundingClientRect();
            containerPositionRef.current = rect;
            const clickX = touch.clientX - rect.left;
            const ratio = Math.max(0, Math.min(1, clickX / rect.width));
            const seekTime = ratio * duration;
            lastSeekValueRef.current = seekTime;
            setTooltipPosition({ x: rect.left + clickX, y: rect.top });
            setTooltipValue(seekTime);
            wavesurfer.seekTo(ratio);
        };

        const handleTouchEnd = () => {
            if (!isDraggingLocal || !wavesurfer) return;

            isDraggingLocal = false;
            const duration = getFiniteDuration(wavesurfer);
            // The media element has no source for cached (peak-only) waveforms,
            // so read the intended position from the last pointer move instead
            // of wavesurfer.getCurrentTime() (always 0 without a source).
            const seekTime = lastSeekValueRef.current ?? wavesurfer.getCurrentTime();

            setTooltipPosition(null);

            if (duration > 0 && seekTime >= 0) {
                mediaSeekToTimestamp(seekTime);
                lastSeekValueRef.current = seekTime;

                seekTimeoutRef.current = setTimeout(() => {
                    setIsDragging(false);
                    lastSeekValueRef.current = null;
                    seekTimeoutRef.current = null;
                }, 1000);
            } else {
                setIsDragging(false);
            }
        };

        container.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);

        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
            if (seekTimeoutRef.current) {
                clearTimeout(seekTimeoutRef.current);
            }
        };
    }, [wavesurfer, songDuration, mediaSeekToTimestamp]);

    // Sync dragging state when currentTime catches up to seek value
    useEffect(() => {
        if (isDragging && lastSeekValueRef.current !== null) {
            const timeDiff = Math.abs(currentTime - lastSeekValueRef.current);
            if (timeDiff < 0.5) {
                setIsDragging(false);
                setTooltipPosition(null);
                lastSeekValueRef.current = null;
                if (seekTimeoutRef.current) {
                    clearTimeout(seekTimeoutRef.current);
                    seekTimeoutRef.current = null;
                }
            }
        }
    }, [currentTime, isDragging]);

    // Update waveform progress based on player current time (only when not dragging)
    useEffect(() => {
        if (!wavesurfer || !songDuration || isDragging) return;

        const duration = getFiniteDuration(wavesurfer);
        if (duration > 0 && currentTime >= 0) {
            const ratio = currentTime / duration;
            wavesurfer.seekTo(ratio);
        }
    }, [wavesurfer, currentTime, songDuration, isDragging]);

    // Show disabled slider when there's no current song
    if (!currentSong) {
        return (
            <CustomPlayerbarSlider
                disabled
                max={100}
                min={0}
                onClick={(e) => {
                    e?.stopPropagation();
                }}
                size={6}
                value={0}
                w="100%"
            />
        );
    }

    return (
        <div
            className={styles.wavesurferContainer}
            onClick={(e) => {
                e?.stopPropagation();
            }}
            style={{ position: 'relative' }}
        >
            <motion.div
                animate={{ opacity: isLoading || hasError ? 0 : 1 }}
                className={styles.waveform}
                initial={{ opacity: 0 }}
                ref={containerRef}
                transition={{ duration: 0.2 }}
            />
            <AnimatePresence>
                {(isLoading || hasError) && (
                    <motion.div
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        initial={{ opacity: 0 }}
                        style={{
                            height: '100%',
                            left: 0,
                            position: 'absolute',
                            top: 3,
                            width: '100%',
                        }}
                        transition={{ duration: 0.2 }}
                    >
                        <PlayerbarSeekSlider max={songDuration} min={0} />
                        {isLoading && !hasError && (
                            <div
                                className={styles.loadProgress}
                                style={{ width: `${loadingProgress}%` }}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
            {tooltipPosition && isDragging && (
                <motion.div
                    animate={{ opacity: 1, scale: 1, x: '-50%' }}
                    className={styles.tooltip}
                    initial={{ opacity: 0, scale: 0.8, x: '-50%' }}
                    style={{
                        left: `${tooltipPosition.x}px`,
                        position: 'fixed',
                        top: `${tooltipPosition.y - 40}px`,
                        zIndex: 1000,
                    }}
                    transition={{ duration: 0.15 }}
                >
                    <Text isNoSelect size="md">
                        {formatDuration(tooltipValue * 1000)}
                    </Text>
                </motion.div>
            )}
        </div>
    );
};
