import { useCallback } from 'react';

import { useFullScreenPlayerStore, useFullScreenPlayerStoreActions } from '/@/renderer/store';

export const useToggleFullScreenPlayer = () => {
    const { expanded } = useFullScreenPlayerStore();
    const { setStore } = useFullScreenPlayerStoreActions();

    return useCallback(() => {
        setStore({
            expanded: !expanded,
            visualizerExpanded: false,
            visualizerReturnToPlayer: false,
        });
    }, [expanded, setStore]);
};
