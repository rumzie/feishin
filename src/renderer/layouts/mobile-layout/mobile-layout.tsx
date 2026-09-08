import clsx from 'clsx';
import { AnimatePresence } from 'motion/react';
import { Suspense, useEffect, useRef } from 'react';
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
    const fullScreenPlayerHistoryRef = useRef(false);
    const { opened: commandPaletteOpened } = useCommandPalette();
    const {
        expanded: isFullScreenPlayerExpanded,
        visualizerExpanded: isFullScreenVisualizerExpanded,
    } = useFullScreenPlayerOverlayState();
    const setFullScreenPlayerStore = useSetFullScreenPlayerStore();
    const windowBarStyle = useWindowBarStyle();

    useEffect(() => {
        if (commandPaletteOpened) closeSidebar();
    }, [closeSidebar, commandPaletteOpened]);

    useEffect(() => {
        if (!isFullScreenPlayerExpanded) {
            if (fullScreenPlayerHistoryRef.current) {
                fullScreenPlayerHistoryRef.current = false;
                window.history.back();
            }

            return undefined;
        }

        if (!fullScreenPlayerHistoryRef.current) {
            window.history.pushState(
                { ...window.history.state, mobileFullscreenPlayer: true },
                '',
                window.location.href,
            );
            fullScreenPlayerHistoryRef.current = true;
        }

        const handlePopState = () => {
            fullScreenPlayerHistoryRef.current = false;
            setFullScreenPlayerStore({ expanded: false });
        };

        window.addEventListener('popstate', handlePopState);

        return () => window.removeEventListener('popstate', handlePopState);
    }, [isFullScreenPlayerExpanded, setFullScreenPlayerStore]);

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
                    <ActionIcon
                        className={styles.drawerButton}
                        icon="menu"
                        onClick={openSidebar}
                        size="lg"
                        tooltip={{ label: 'Menu' }}
                        variant="subtle"
                    />
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
                    size="320px"
                    styles={{
                        body: {
                            height: '100%',
                            padding: 0,
                        },
                        content: {
                            height: '100%',
                            width: '100%',
                        },
                    }}
                    withCloseButton={false}
                >
                    <MobileSidebar />
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
