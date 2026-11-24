import { useModals } from '@mantine/modals';
import clsx from 'clsx';
import { AnimatePresence } from 'motion/react';
import { Suspense, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import styles from './mobile-layout.module.css';

import { ContextMenuController } from '/@/renderer/features/context-menu/context-menu-controller';
import { FullScreenVisualizer } from '/@/renderer/features/player/components/full-screen-visualizer';
import { MobileFullscreenPlayer } from '/@/renderer/features/player/components/mobile-fullscreen-player';
import { MobileSidebar } from '/@/renderer/features/sidebar/components/mobile-sidebar';
import { PlayerBar } from '/@/renderer/layouts/default-layout/player-bar';
import { WindowBar } from '/@/renderer/layouts/window-bar';
import {
    useCommandPalette,
    useFullScreenPlayerOverlayState,
    useFullScreenPlayerStore,
    useSetFullScreenPlayerStore,
    useWindowBarStyle,
} from '/@/renderer/store';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Drawer } from '/@/shared/components/drawer/drawer';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { useDisclosure } from '/@/shared/hooks/use-disclosure';
import { Platform } from '/@/shared/types/types';

interface MobileLayoutProps {
    shell?: boolean;
}

export const MobileLayout = ({ shell }: MobileLayoutProps) => {
    const [sidebarOpened, { close: closeSidebar, open: openSidebar }] = useDisclosure(false);
    const { closeAll: closeAllModals, modals } = useModals();
    const fullScreenPlayerHistoryRef = useRef(false);
    const fullScreenPlayerExpandedRef = useRef(false);
    const modalHistoryRef = useRef(false);
    const modalOpenRef = useRef(false);
    const closingModalViaBackRef = useRef(false);
    const queueHistoryRef = useRef(false);
    const queueOpenRef = useRef(false);
    const closingQueueViaBackRef = useRef(false);
    const skipNextPopStateRef = useRef(false);
    const { open: openCommandPalette, opened: commandPaletteOpened } = useCommandPalette();
    const { t } = useTranslation();
    const {
        expanded: isFullScreenPlayerExpanded,
        visualizerExpanded: isFullScreenVisualizerExpanded,
    } = useFullScreenPlayerOverlayState();
    const mobileQueueOpen = useFullScreenPlayerStore((state) => state.mobileQueueOpen);
    const setFullScreenPlayerStore = useSetFullScreenPlayerStore();
    const windowBarStyle = useWindowBarStyle();

    const modalOpen = modals.length > 0;
    const isQueueOpen = isFullScreenPlayerExpanded && mobileQueueOpen;

    useEffect(() => {
        fullScreenPlayerExpandedRef.current = isFullScreenPlayerExpanded;
    }, [isFullScreenPlayerExpanded]);

    useEffect(() => {
        modalOpenRef.current = modalOpen;
    }, [modalOpen]);

    useEffect(() => {
        queueOpenRef.current = isQueueOpen;
    }, [isQueueOpen]);

    useEffect(() => {
        if (commandPaletteOpened) closeSidebar();
    }, [closeSidebar, commandPaletteOpened]);

    useEffect(() => {
        if (!isFullScreenPlayerExpanded) {
            if (queueHistoryRef.current) {
                queueHistoryRef.current = false;
                closingQueueViaBackRef.current = false;

                if (window.history.state?.mobileQueue) {
                    skipNextPopStateRef.current = true;
                    window.history.back();
                }
            }

            if (fullScreenPlayerHistoryRef.current) {
                fullScreenPlayerHistoryRef.current = false;

                // Only pop the pushed overlay entry if we haven't navigated away
                // from it (e.g. an album/artist link), otherwise we'd undo that
                // navigation.
                if (window.history.state?.mobileFullscreenPlayer) {
                    skipNextPopStateRef.current = true;
                    window.history.back();
                }
            }

            return;
        }

        if (!fullScreenPlayerHistoryRef.current) {
            window.history.pushState(
                { ...window.history.state, mobileFullscreenPlayer: true },
                '',
                window.location.href,
            );
            fullScreenPlayerHistoryRef.current = true;
        }
    }, [isFullScreenPlayerExpanded]);

    // Push a history entry while the mobile queue is open so the Android/browser
    // back button closes the queue instead of the full-screen player.
    useEffect(() => {
        if (!isFullScreenPlayerExpanded) {
            return;
        }

        if (isQueueOpen) {
            if (queueHistoryRef.current) {
                return;
            }

            queueHistoryRef.current = true;
            window.history.pushState(
                { ...window.history.state, mobileQueue: true },
                '',
                window.location.href,
            );
            return;
        }

        if (!queueHistoryRef.current) {
            return;
        }

        queueHistoryRef.current = false;

        if (closingQueueViaBackRef.current) {
            closingQueueViaBackRef.current = false;
            return;
        }

        // The queue was closed by its own UI, so remove the history entry we
        // added without triggering the back navigation handlers.
        if (window.history.state?.mobileQueue) {
            skipNextPopStateRef.current = true;
            window.history.back();
        }
    }, [isFullScreenPlayerExpanded, isQueueOpen]);

    // Push a history entry while a modal is open so the Android/browser back
    // button closes the modal instead of navigating the page behind it.
    useEffect(() => {
        if (modalOpen) {
            if (modalHistoryRef.current) {
                return;
            }

            modalHistoryRef.current = true;
            window.history.pushState(
                { ...window.history.state, mobileModal: true },
                '',
                window.location.href,
            );
            return;
        }

        if (!modalHistoryRef.current) {
            return;
        }

        modalHistoryRef.current = false;

        if (closingModalViaBackRef.current) {
            closingModalViaBackRef.current = false;
            return;
        }

        // The modal was closed by its own UI, so remove the history entry we
        // added without triggering the back navigation handlers.
        skipNextPopStateRef.current = true;
        window.history.back();
    }, [modalOpen]);

    useEffect(() => {
        const handlePopState = () => {
            if (skipNextPopStateRef.current) {
                skipNextPopStateRef.current = false;
                return;
            }

            if (modalOpenRef.current) {
                closingModalViaBackRef.current = true;
                closeAllModals();
                return;
            }

            if (queueOpenRef.current) {
                closingQueueViaBackRef.current = true;
                queueHistoryRef.current = false;
                setFullScreenPlayerStore({ mobileQueueOpen: false });
                return;
            }

            if (!fullScreenPlayerExpandedRef.current) {
                return;
            }

            fullScreenPlayerHistoryRef.current = false;
            setFullScreenPlayerStore({ expanded: false });
        };

        window.addEventListener('popstate', handlePopState);

        return () => window.removeEventListener('popstate', handlePopState);
    }, [closeAllModals, setFullScreenPlayerStore]);

    return (
        <>
            <div
                className={clsx(styles.layout, {
                    [styles.macos]: windowBarStyle === Platform.MACOS,
                    [styles.windows]: windowBarStyle === Platform.WINDOWS,
                })}
                id="mobile-layout"
            >
                {!shell && <WindowBar />}
                {!shell && (
                    <>
                        <ActionIcon
                            className={styles.drawerButton}
                            icon="menu"
                            onClick={openSidebar}
                            size="lg"
                            tooltip={{ label: 'Menu' }}
                            variant="subtle"
                        />
                        <ActionIcon
                            className={styles.searchButton}
                            icon="search"
                            onClick={openCommandPalette}
                            size="lg"
                            tooltip={{ label: t('common.search') }}
                            variant="subtle"
                        />
                    </>
                )}
                <main className={styles.mainContent}>
                    <Suspense fallback={<Spinner container />}>
                        <Outlet />
                    </Suspense>
                </main>
                <PlayerBar />
            </div>
            {!shell && (
                <Drawer
                    onClose={closeSidebar}
                    opened={sidebarOpened}
                    position="left"
                    size="75vw"
                    styles={{
                        body: {
                            height: '100%',
                            padding: 0,
                        },
                        content: {
                            flex: '0 0 auto',
                            height: '100%',
                            maxWidth: '100%',
                            minWidth: 0,
                            width: '75vw',
                        },
                    }}
                    withCloseButton={false}
                >
                    <MobileSidebar onNavigate={closeSidebar} />
                </Drawer>
            )}
            <AnimatePresence initial={false}>
                {isFullScreenPlayerExpanded && (
                    <div className={styles.fullScreenPlayerOverlay}>
                        <MobileFullscreenPlayer />
                    </div>
                )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
                {isFullScreenVisualizerExpanded && (
                    <div className={styles.fullScreenPlayerOverlay}>
                        <FullScreenVisualizer />
                    </div>
                )}
            </AnimatePresence>
            <ContextMenuController.Root />
        </>
    );
};
