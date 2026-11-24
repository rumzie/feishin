import type { TitleProps as MantineTitleProps } from '@mantine/core';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { createPolymorphicComponent, Title as MantineHeader } from '@mantine/core';
import clsx from 'clsx';
import { forwardRef } from 'react';

import styles from './text-title.module.css';

type MantineTextTitleDivProps = ComponentPropsWithoutRef<'div'> & MantineTitleProps;

interface TextTitleProps extends MantineTextTitleDivProps {
    children?: ReactNode;
    isLink?: boolean;
    isMuted?: boolean;
    isNoSelect?: boolean;
    overflow?: 'hidden' | 'visible';
    to?: string;
    weight?: number;
}

const _TextTitle = forwardRef<HTMLHeadingElement, TextTitleProps>(
    ({ children, className, isLink, isMuted, isNoSelect, overflow, weight, ...rest }, ref) => {
        return (
            <MantineHeader
                className={clsx(
                    styles.root,
                    {
                        [styles.link]: isLink,
                        [styles.muted]: isMuted,
                        [styles.noSelect]: isNoSelect,
                        [styles.overflowHidden]: overflow === 'hidden' && !rest.lineClamp,
                    },
                    className,
                )}
                fw={weight}
                ref={ref}
                {...rest}
            >
                {children}
            </MantineHeader>
        );
    },
);

_TextTitle.displayName = 'TextTitle';

export const TextTitle = createPolymorphicComponent<'div', TextTitleProps>(_TextTitle);
