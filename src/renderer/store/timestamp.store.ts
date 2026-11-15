import { del, get, set } from 'idb-keyval';
import { useSyncExternalStore } from 'react';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { createWithEqualityFn } from 'zustand/traditional';

const PLAYER_TIMESTAMP_POLL_INTERVAL_MS = 500;

interface TimestampState {
    setTimestamp: (timestamp: number) => void;
    timestamp: number;
}

const timestampStorage = {
    getItem: async (name: string) => {
        const value = await get(name);
        if (value === undefined) {
            return null;
        }
        return { state: { timestamp: value }, version: 1 } as const;
    },
    removeItem: async (name: string) => {
        await del(name);
    },
    setItem: async (name: string, value: { state: { timestamp: number }; version?: number }) => {
        await set(name, value.state.timestamp);
    },
};

export const useTimestampStoreBase = createWithEqualityFn<TimestampState>()(
    persist(
        subscribeWithSelector((set) => ({
            setTimestamp: (timestamp: number) => {
                set({ timestamp });
            },
            timestamp: 0,
        })),
        {
            name: 'player-timestamp',
            storage: timestampStorage,
            version: 1,
        },
    ),
);

export const subscribePlayerProgress = (
    onChange: (properties: { timestamp: number }, prev: { timestamp: number }) => void,
) => {
    return useTimestampStoreBase.subscribe(
        (state) => state.timestamp,
        (timestamp, prevTimestamp) => {
            onChange({ timestamp }, { timestamp: prevTimestamp });
        },
        {
            equalityFn: (a, b) => {
                return a === b;
            },
        },
    );
};

export const usePlayerProgress = () => {
    return useTimestampStoreBase((state) => state.timestamp);
};

let polledTimestamp = useTimestampStoreBase.getState().timestamp;
let pollInterval: ReturnType<typeof setInterval> | null = null;
const polledTimestampListeners = new Set<() => void>();

const emitPolledTimestamp = () => {
    for (const listener of polledTimestampListeners) {
        listener();
    }
};

const syncPolledTimestamp = () => {
    const nextTimestamp = useTimestampStoreBase.getState().timestamp;
    if (nextTimestamp !== polledTimestamp) {
        polledTimestamp = nextTimestamp;
        emitPolledTimestamp();
    }
};

const startTimestampPolling = () => {
    if (pollInterval) {
        return;
    }

    polledTimestamp = useTimestampStoreBase.getState().timestamp;
    pollInterval = setInterval(syncPolledTimestamp, PLAYER_TIMESTAMP_POLL_INTERVAL_MS);
};

const stopTimestampPolling = () => {
    if (!pollInterval) {
        return;
    }

    clearInterval(pollInterval);
    pollInterval = null;
};

const subscribePolledTimestamp = (listener: () => void) => {
    polledTimestampListeners.add(listener);
    if (polledTimestampListeners.size === 1) {
        startTimestampPolling();
    }

    return () => {
        polledTimestampListeners.delete(listener);
        if (polledTimestampListeners.size === 0) {
            stopTimestampPolling();
        }
    };
};

const getPolledTimestamp = () => polledTimestamp;

export const usePlayerTimestamp = () => {
    return useSyncExternalStore(subscribePolledTimestamp, getPolledTimestamp, getPolledTimestamp);
};

export const setTimestamp = (timestamp: number) => {
    useTimestampStoreBase.getState().setTimestamp(timestamp);
};
