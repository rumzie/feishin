import { useCallback, useRef } from 'react';

interface UseLongPressOptions<T extends HTMLElement = HTMLElement> {
    delay?: number;
    onClick?: (event: React.MouseEvent<T> | React.TouchEvent<T>) => void;
    onFinish?: (event: null | React.MouseEvent<T> | React.TouchEvent<T>) => void;
    onLongPress?: (event: React.MouseEvent<T> | React.TouchEvent<T>) => void;
    onStart?: (event: React.MouseEvent<T> | React.TouchEvent<T>) => void;
}

interface UseLongPressReturn {
    onMouseDown: (event: React.MouseEvent) => void;
    onMouseLeave: (event: React.MouseEvent) => void;
    onMouseUp: (event: React.MouseEvent) => void;
    onTouchCancel: (event: React.TouchEvent) => void;
    onTouchEnd: (event: React.TouchEvent) => void;
    onTouchMove: (event: React.TouchEvent) => void;
    onTouchStart: (event: React.TouchEvent) => void;
}

const TOUCH_MOVE_THRESHOLD = 10;

export const useLongPress = <T extends HTMLElement = HTMLElement>({
    delay = 500,
    onClick,
    onFinish,
    onLongPress,
    onStart,
}: UseLongPressOptions<T>): UseLongPressReturn => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const targetRef = useRef<EventTarget | null>(null);
    const longPressTriggeredRef = useRef(false);
    const eventRef = useRef<null | React.MouseEvent<T> | React.TouchEvent<T>>(null);
    const touchStartRef = useRef<null | { x: number; y: number }>(null);
    const touchMovedRef = useRef(false);

    const start = useCallback(
        (event: React.MouseEvent<T> | React.TouchEvent<T>) => {
            longPressTriggeredRef.current = false;
            targetRef.current = event.target;
            eventRef.current = event;

            onStart?.(event);

            timeoutRef.current = setTimeout(() => {
                longPressTriggeredRef.current = true;
                if (eventRef.current) {
                    onLongPress?.(eventRef.current);
                }
            }, delay);
        },
        [onLongPress, onStart, delay],
    );

    const clear = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const handleMouseDown = useCallback(
        (event: React.MouseEvent) => {
            if (event.button !== 0) {
                return;
            }
            event.preventDefault();
            start(event as React.MouseEvent<T>);
        },
        [start],
    );

    const handleMouseUp = useCallback(() => {
        const event = eventRef.current;
        clear();
        if (!longPressTriggeredRef.current && onClick && event) {
            onClick(event);
        }
        onFinish?.(event || null);
        longPressTriggeredRef.current = false;
        eventRef.current = null;
    }, [clear, onClick, onFinish]);

    const handleMouseLeave = useCallback(() => {
        const event = eventRef.current;
        clear();
        onFinish?.(event || null);
        longPressTriggeredRef.current = false;
        eventRef.current = null;
    }, [clear, onFinish]);

    const handleTouchStart = useCallback(
        (event: React.TouchEvent) => {
            const touch = event.touches[0];
            touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
            touchMovedRef.current = false;
            start(event as React.TouchEvent<T>);
        },
        [start],
    );

    const handleTouchMove = useCallback(
        (event: React.TouchEvent) => {
            const start = touchStartRef.current;
            const touch = event.touches[0];
            if (!start || !touch) {
                return;
            }

            if (
                Math.abs(touch.clientX - start.x) > TOUCH_MOVE_THRESHOLD ||
                Math.abs(touch.clientY - start.y) > TOUCH_MOVE_THRESHOLD
            ) {
                touchMovedRef.current = true;
                clear();
            }
        },
        [clear],
    );

    const handleTouchEnd = useCallback(() => {
        const event = eventRef.current;
        const moved = touchMovedRef.current;
        clear();
        if (!moved && !longPressTriggeredRef.current && onClick && event) {
            onClick(event);
        }
        onFinish?.(event || null);
        longPressTriggeredRef.current = false;
        touchMovedRef.current = false;
        touchStartRef.current = null;
        eventRef.current = null;
    }, [clear, onClick, onFinish]);

    const handleTouchCancel = useCallback(() => {
        const event = eventRef.current;
        clear();
        onFinish?.(event || null);
        longPressTriggeredRef.current = false;
        touchMovedRef.current = false;
        touchStartRef.current = null;
        eventRef.current = null;
    }, [clear, onFinish]);

    return {
        onMouseDown: handleMouseDown,
        onMouseLeave: handleMouseLeave,
        onMouseUp: handleMouseUp,
        onTouchCancel: handleTouchCancel,
        onTouchEnd: handleTouchEnd,
        onTouchMove: handleTouchMove,
        onTouchStart: handleTouchStart,
    };
};
