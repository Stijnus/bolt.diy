import { memo } from 'react';

export const genericMemo: <T extends React.ElementType>(
  component: T,
  propsAreEqual?: (prevProps: React.ComponentProps<T>, nextProps: React.ComponentProps<T>) => boolean,
) => T & { displayName?: string } = memo;
