import formatDuration from 'format-duration';
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { PlayerbarSeekSlider } from './playerbar-seek-slider';
import styles from './playerbar-slider.module.css';

import { ScrobbleStatus } from '/@/renderer/features/player/components/scrobble-status';
import {
    useIsPlayerbarWaveformLoading,
    usePlayerbarWaveformProgress,
} from '/@/renderer/features/player/store/playerbar-waveform.store';
import {
    useAppStore,
    useAppStoreActions,
    usePlayerSong,
    usePlayerTimestamp,
} from '/@/renderer/store';
import { PlayerbarSliderType, usePlayerbarSlider } from '/@/renderer/store/settings.store';
import { Group } from '/@/shared/components/group/group';
import { Slider, SliderProps } from '/@/shared/components/slider/slider';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { Text } from '/@/shared/components/text/text';
import { Tooltip } from '/@/shared/components/tooltip/tooltip';
import { PlaybackSelectors } from '/@/shared/constants/playback-selectors';

const PlayerbarWaveform = lazy(() =>
    import('./playerbar-waveform').then((module) => ({
        default: module.PlayerbarWaveform,
    })),
);

export const PlayerbarSlider = () => {
    const { t } = useTranslation();
    const currentSong = usePlayerSong();
    const playerbarSlider = usePlayerbarSlider();
    const isWaveformLoading = useIsPlayerbarWaveformLoading();
    const waveformProgress = usePlayerbarWaveformProgress();

    const songDuration = currentSong?.duration ? currentSong.duration / 1000 : 0;
    const currentTime = usePlayerTimestamp();

    const formattedDuration = formatDuration(songDuration * 1000 || 0);
    const formattedTimeRemaining = formatDuration((currentTime - songDuration) * 1000 || 0);

    const showTimeRemaining = useAppStore((state) => state.showTimeRemaining);
    const { setShowTimeRemaining } = useAppStoreActions();

    const isWaveform = playerbarSlider?.type === PlayerbarSliderType.WAVEFORM;
    const showWaveformLoading = isWaveform && isWaveformLoading;

    return (
        <>
            <div className={styles.sliderContainer}>
                <div className={styles.sliderValueWrapper}>
                    <ScrobbleStatus />
                </div>
                <div className={styles.sliderWrapper}>
                    {isWaveform ? (
                        <Suspense fallback={<Spinner />}>
                            <PlayerbarWaveform />
                        </Suspense>
                    ) : (
                        <PlayerbarSeekSlider max={songDuration} min={0} />
                    )}
                </div>
                <div className={styles.sliderValueWrapper}>
                    <Group gap="xs">
                        {showWaveformLoading && (
                            <Tooltip
                                color="primary"
                                label={t('player.waveformLoading', { pct: waveformProgress })}
                                position="top"
                            >
                                <span aria-hidden className={styles.waveformLoadingDot} />
                            </Tooltip>
                        )}
                        <Text
                            className={PlaybackSelectors.totalDuration}
                            fw={600}
                            isMuted
                            isNoSelect
                            onClick={() => setShowTimeRemaining(!showTimeRemaining)}
                            role="button"
                            size="xs"
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                            {showTimeRemaining ? formattedTimeRemaining : formattedDuration}
                        </Text>
                    </Group>
                </div>
            </div>
        </>
    );
};

export const CustomPlayerbarSlider = ({ ...props }: SliderProps) => {
    return (
        <Slider
            classNames={{
                bar: styles.bar,
                label: styles.label,
                root: styles.root,
                thumb: styles.thumb,
            }}
            {...props}
            size={6}
        />
    );
};
