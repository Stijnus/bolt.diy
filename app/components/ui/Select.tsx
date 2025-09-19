import { forwardRef } from 'react';
import { classNames } from '~/utils/classNames';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={classNames(
        'flex h-10 w-full rounded-md border border-bolt-elements-borderColor',
        'bg-black text-bolt-elements-textPrimary',
        'px-3 py-2 text-sm ring-offset-bolt-elements-background-depth-1',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

Select.displayName = 'Select';

export { Select };
