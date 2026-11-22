import { useTranslation } from 'react-i18next';

import { SONG_TABLE_COLUMNS } from '/@/renderer/components/item-list/item-table-list/default-columns';
import { useToggleFullScreenPlayer } from '/@/renderer/features/player/hooks/use-toggle-full-screen-player';
import { openFullScreenPlayerSettingsModal } from '/@/renderer/features/player/utils/open-full-screen-player-settings-modal';
import {
    ListConfigMenu,
    SONG_DISPLAY_TYPES,
} from '/@/renderer/features/shared/components/list-config-menu';
import { useHotkeys } from '/@/renderer/hooks/use-hotkeys';
import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { ItemListKey, ListDisplayType } from '/@/shared/types/types';

export const SharedFullscreenPlayerSettings = () => {
    const { t } = useTranslation();
    const handleToggleFullScreenPlayer = useToggleFullScreenPlayer();

    useHotkeys([['Escape', handleToggleFullScreenPlayer]]);

    return (
        <>
            <ActionIcon
                icon="arrowDownS"
                iconProps={{ size: 'lg' }}
                onClick={handleToggleFullScreenPlayer}
                tooltip={{ label: t('common.minimize') }}
                variant="subtle"
            />
            <ActionIcon
                icon="settings2"
                iconProps={{ size: 'lg' }}
                onClick={openFullScreenPlayerSettingsModal}
                tooltip={{ label: t('common.configure') }}
                variant="subtle"
            />
            <ListConfigMenu
                buttonProps={{
                    variant: 'subtle',
                }}
                displayTypes={[
                    { hidden: true, value: ListDisplayType.GRID },
                    ...SONG_DISPLAY_TYPES,
                ]}
                listKey={ItemListKey.FULL_SCREEN}
                optionsConfig={{
                    table: {
                        itemsPerPage: { hidden: true },
                        pagination: { hidden: true },
                    },
                }}
                tableColumnsData={SONG_TABLE_COLUMNS}
            />
        </>
    );
};
