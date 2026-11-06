import { Center } from '@mantine/core';
import clsx from 'clsx';
import { memo } from 'react';
import { IconBaseProps } from 'react-icons';
import { LuLoader } from 'react-icons/lu';

import dogeIcon from '../../../../assets/icons/128x128.png';
import styles from './spinner.module.css';

import { IconColor } from '/@/shared/components/icon/icon';

interface SpinnerProps extends IconBaseProps {
    color?: IconColor | string;
    container?: boolean;
}

const sizeMap: Record<string, string> = {
    '2xl': 'var(--theme-font-size-2xl)',
    '3xl': 'var(--theme-font-size-3xl)',
    '4xl': 'var(--theme-font-size-4xl)',
    '5xl': 'var(--theme-font-size-5xl)',
    lg: 'var(--theme-font-size-lg)',
    md: 'var(--theme-font-size-md)',
    sm: 'var(--theme-font-size-sm)',
    xl: 'var(--theme-font-size-xl)',
    xs: 'var(--theme-font-size-xs)',
};

export const SpinnerIcon = LuLoader;

const _Spinner = ({ className, container, size = '5xl', style }: SpinnerProps) => {
    const dimension = typeof size === 'number' ? `${size}px` : (sizeMap[size] ?? size);

    const image = (
        <img
            alt=""
            className={clsx(styles.icon, className)}
            src={dogeIcon}
            style={{ height: dimension, width: dimension, ...style }}
        />
    );

    if (container) {
        return <Center className={styles.container}>{image}</Center>;
    }

    return image;
};

_Spinner.displayName = 'Spinner';

export const Spinner = memo(_Spinner);
