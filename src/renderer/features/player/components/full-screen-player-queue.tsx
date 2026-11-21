import clsx from 'clsx';
import { AnimatePresence, motion, Variants } from 'motion/react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './full-screen-player-queue.module.css';

import { Lyrics } from '/@/renderer/features/lyrics/lyrics';
import { PlayQueue } from '/@/renderer/features/now-playing/components/play-queue';
import { FullScreenSimilarSongs } from '/@/renderer/features/player/components/full-screen-similar-songs';
import { ResizeHandle } from '/@/renderer/features/shared/components/resize-handle';
import { useListSettings, usePlaybackSettings, useSettingsStore } from '/@/renderer/store';
import {
    useFullScreenPlayerStore,
    useFullScreenPlayerStoreActions,
} from '/@/renderer/store/full-screen-player.store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Group } from '/@/shared/components/group/group';
import { AppIcon } from '/@/shared/components/icon/icon';
import { ItemListKey } from '/@/shared/types/types';

const AudioMotionAnalyzerVisualizer = lazy(() =>
    import('../../visualizer/components/audiomotionanalyzer/visualizer').then((module) => ({
        default: module.Visualizer,
    })),
);

const ButterchurnVisualizer = lazy(() =>
    import('../../visualizer/components/butternchurn/visualizer').then((module) => ({
        default: module.Visualizer,
    })),
);

const VisualizerContent = () => {
    const visualizerType = useSettingsStore((store) => store.visualizer.type);

    return (
        <Suspense fallback={<></>}>
            {visualizerType === 'butterchurn' ? (
                <ButterchurnVisualizer />
            ) : (
                <AudioMotionAnalyzerVisualizer />
            )}
        </Suspense>
    );
};

const isDesktopPanelOpen = (activeTab: string, webAudio: boolean) =>
    activeTab === 'queue' ||
    activeTab === 'related' ||
    activeTab === 'lyrics' ||
    (activeTab === 'visualizer' && webAudio) ||
    (activeTab === 'split' && webAudio);

const moduleContentVariants: Variants = {
    animate: {
        opacity: 1,
        transition: {
            duration: 0.4,
            ease: 'easeOut',
        },
        x: 0,
    },
    exit: {
        opacity: 0,
        transition: {
            duration: 0.4,
            ease: 'easeOut',
        },
        x: '10%',
    },
    initial: {
        opacity: 0,
        x: '10%',
    },
};

interface ControlItem {
    active: boolean;
    icon: keyof typeof AppIcon;
    label: string;
    onClick: () => void;
}

const Controls = () => {
    const { t } = useTranslation();
    const { activeTab } = useFullScreenPlayerStore();
    const { setStore } = useFullScreenPlayerStoreActions();
    const { webAudio } = usePlaybackSettings();

    const toggleTab = (tab: string) => {
        setStore({ activeTab: activeTab === tab ? '' : tab });
    };

    const headerItems = useMemo(() => {
        const items: ControlItem[] = [
            {
                active: activeTab === 'queue',
                icon: 'queue',
                label: t('page.fullscreenPlayer.upNext'),
                onClick: () => toggleTab('queue'),
            },
            {
                active: activeTab === 'related',
                icon: 'related',
                label: t('page.fullscreenPlayer.related'),
                onClick: () => toggleTab('related'),
            },
            {
                active: activeTab === 'lyrics',
                icon: 'microphone',
                label: t('page.fullscreenPlayer.lyrics'),
                onClick: () => toggleTab('lyrics'),
            },
        ];

        if (webAudio) {
            items.push({
                active: activeTab === 'visualizer',
                icon: 'audioLines',
                label: t('page.fullscreenPlayer.visualizer'),
                onClick: () => toggleTab('visualizer'),
            });
            items.push({
                active: activeTab === 'split',
                icon: 'layoutPanelBottom',
                label: t('page.fullscreenPlayer.split'),
                onClick: () => toggleTab('split'),
            });
        }

        return items;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, setStore, t, webAudio]);

    return (
        <Group
            className={clsx(styles.controlsContainer, 'full-screen-player-controls-container')}
            gap="xs"
            p="0.5rem"
            pos="absolute"
        >
            {headerItems.map((item) => (
                <div key={`tab-${item.label}`}>
                    <ActionIcon
                        icon={item.icon}
                        iconProps={{
                            color: item.active ? 'primary' : undefined,
                            size: 'lg',
                        }}
                        onClick={item.onClick}
                        tooltip={{ label: item.label }}
                        variant="subtle"
                    ></ActionIcon>
                </div>
            ))}
        </Group>
    );
};

export const FullScreenPlayerControls = Controls;

export const FullScreenPlayerQueue = () => {
    const { activeTab, splitVisualizerHeight } = useFullScreenPlayerStore();
    const { setStore } = useFullScreenPlayerStoreActions();
    const { webAudio } = usePlaybackSettings();
    const { table } = useListSettings(ItemListKey.FULL_SCREEN) || {};
    const [isSplitResizing, setIsSplitResizing] = useState(false);
    const splitRef = useRef<HTMLDivElement | null>(null);
    const initialMouseYRef = useRef(0);
    const initialVisualizerHeightRef = useRef(splitVisualizerHeight);
    const queueContainerClassName = clsx(styles.queueContainer, {
        [styles.queueContainerFadeTopBottom]: !table?.enableHeader,
    });
    const isPanelOpen = isDesktopPanelOpen(activeTab, webAudio);
    const isCollapsed = !isPanelOpen;

    const resizeSplit = useCallback(
        (event: MouseEvent) => {
            const containerHeight = splitRef.current?.clientHeight;
            if (!containerHeight) return;

            const delta = ((event.clientY - initialMouseYRef.current) / containerHeight) * 100;
            const nextHeight = initialVisualizerHeightRef.current - delta;
            setStore({ splitVisualizerHeight: Math.min(70, Math.max(15, nextHeight)) });
        },
        [setStore],
    );

    const stopSplitResize = useCallback(() => setIsSplitResizing(false), []);

    useEffect(() => {
        if (!isSplitResizing) return;

        window.addEventListener('mousemove', resizeSplit);
        window.addEventListener('mouseup', stopSplitResize);

        return () => {
            window.removeEventListener('mousemove', resizeSplit);
            window.removeEventListener('mouseup', stopSplitResize);
        };
    }, [isSplitResizing, resizeSplit, stopSplitResize]);

    return (
        <div
            className={clsx(styles.gridContainer, 'full-screen-player-queue-container', {
                [styles.gridContainerCollapsed]: isCollapsed,
            })}
        >
            <AnimatePresence initial={false} mode="wait">
                {activeTab === 'split' && webAudio ? (
                    <motion.div
                        animate="animate"
                        className={styles.splitContent}
                        exit="exit"
                        initial="initial"
                        key="split"
                        ref={splitRef}
                        variants={moduleContentVariants}
                    >
                        <div className={styles.splitLyrics}>
                            <ResizeHandle
                                isResizing={isSplitResizing}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    initialMouseYRef.current = event.clientY;
                                    initialVisualizerHeightRef.current = splitVisualizerHeight;
                                    setIsSplitResizing(true);
                                }}
                                placement="bottom"
                            />
                            <Lyrics fadeOutNoLyricsMessage={false} />
                        </div>
                        <div
                            className={styles.splitVisualizer}
                            style={{ flexBasis: `${splitVisualizerHeight}%` }}
                        >
                            <VisualizerContent />
                        </div>
                    </motion.div>
                ) : activeTab === 'queue' ? (
                    <motion.div
                        animate="animate"
                        className={queueContainerClassName}
                        exit="exit"
                        initial="initial"
                        key="queue"
                        variants={moduleContentVariants}
                    >
                        <PlayQueue
                            enableScrollShadow={false}
                            listKey={ItemListKey.FULL_SCREEN}
                            searchTerm={undefined}
                        />
                    </motion.div>
                ) : activeTab === 'related' ? (
                    <motion.div
                        animate="animate"
                        className={queueContainerClassName}
                        exit="exit"
                        initial="initial"
                        key="related"
                        variants={moduleContentVariants}
                    >
                        <FullScreenSimilarSongs />
                    </motion.div>
                ) : activeTab === 'lyrics' ? (
                    <motion.div
                        animate="animate"
                        className={styles.moduleContent}
                        exit="exit"
                        initial="initial"
                        key="lyrics"
                        variants={moduleContentVariants}
                    >
                        <Lyrics fadeOutNoLyricsMessage={false} />
                    </motion.div>
                ) : activeTab === 'visualizer' && webAudio ? (
                    <motion.div
                        animate="animate"
                        className={styles.moduleContent}
                        exit="exit"
                        initial="initial"
                        key="visualizer"
                        variants={moduleContentVariants}
                    >
                        <VisualizerContent />
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </div>
    );
};
