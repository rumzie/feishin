import { closeAllModals } from '@mantine/modals';
import { AnimatePresence } from 'motion/react';
import {
    CSSProperties,
    memo,
    ReactNode,
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';

import styles from './library-header-bar.module.css';

import { useIsPlayerFetching, usePlayer } from '/@/renderer/features/player/context/player-context';
import { DefaultPlayButton } from '/@/renderer/features/shared/components/play-button';
import { PlayButtonGroupPopover } from '/@/renderer/features/shared/components/play-button-group';
import { useCurrentServerId } from '/@/renderer/store';
import { Badge, BadgeProps } from '/@/shared/components/badge/badge';
import { Spinner } from '/@/shared/components/spinner/spinner';
import { TextTitle } from '/@/shared/components/text-title/text-title';
import { LibraryItem, Song } from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';

interface LibraryHeaderBarProps {
    children: ReactNode;
    ignoreMaxWidth?: boolean;
}

const LibraryHeaderBarComponent = ({ children, ignoreMaxWidth }: LibraryHeaderBarProps) => {
    return (
        <div
            className={styles.headerContainer}
            style={ignoreMaxWidth ? ({ maxWidth: 'none' } as CSSProperties) : undefined}
        >
            {children}
        </div>
    );
};

interface HeaderPlayButtonProps {
    className?: string;
    ids?: string[];
    itemType: LibraryItem;
    listQuery?: Record<string, any>;
    songs?: Song[];
    variant?: 'default' | 'filled';
}

interface TitleProps {
    children: ReactNode;
    className?: string;
    order?: number;
    style?: CSSProperties;
}

const HeaderPlayButton = ({
    className,
    ids,
    itemType,
    listQuery,
    songs,
    variant = 'filled',
    ...props
}: HeaderPlayButtonProps) => {
    const serverId = useCurrentServerId();
    const player = usePlayer();

    const handlePlay = useCallback(
        (playType: Play) => {
            if (listQuery) {
                player.addToQueueByListQuery(serverId, listQuery, itemType, playType);
            } else if (ids) {
                player.addToQueueByFetch(serverId, ids, itemType, playType);
            } else if (songs) {
                player.addToQueueByData(songs, playType);
            }

            closeAllModals();
        },
        [listQuery, ids, songs, player, serverId, itemType],
    );

    const isPlayerFetching = useIsPlayerFetching();

    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    return (
        <div className={styles.playButtonContainer}>
            <DefaultPlayButton
                className={className}
                loading={isPlayerFetching}
                onClick={() => setIsOpen((prev) => !prev)}
                ref={buttonRef}
                variant={variant}
                {...props}
            />
            <AnimatePresence>
                {isOpen && (
                    <PlayButtonGroupPopover
                        loading={isPlayerFetching}
                        onClose={() => setIsOpen(false)}
                        onPlay={handlePlay}
                        position="bottom"
                        triggerRef={buttonRef}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

const Title = ({ children, className, order = 1, style }: TitleProps) => {
    const ref = useRef<HTMLHeadingElement>(null);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        const fit = () => {
            el.style.fontSize = '';
            const max = parseFloat(getComputedStyle(el).fontSize);
            let size = max;
            while (size > 14 && el.scrollWidth > el.clientWidth) {
                size -= 1;
                el.style.fontSize = `${size}px`;
            }
        };

        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        if (el.parentElement) ro.observe(el.parentElement);
        return () => ro.disconnect();
    }, [children]);

    return (
        <TextTitle
            className={className}
            fw={700}
            order={order as any}
            overflow="hidden"
            ref={ref}
            style={{ flex: '0 1 auto', minWidth: 0, ...style }}
        >
            {children}
        </TextTitle>
    );
};

interface HeaderBadgeProps extends BadgeProps {
    isLoading?: boolean;
}

const HeaderBadge = ({ children, isLoading, ...props }: HeaderBadgeProps) => {
    return <Badge {...props}>{isLoading ? <Spinner container size="sm" /> : children}</Badge>;
};

export const LibraryHeaderBar = Object.assign(memo(LibraryHeaderBarComponent), {
    Badge: HeaderBadge,
    PlayButton: HeaderPlayButton,
    Title,
});
