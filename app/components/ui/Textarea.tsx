import { forwardRef } from 'react';
import { classNames } from '~/utils/classNames';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={classNames(
        'flex w-full min-h-[100px] rounded-md border border-bolt-elements-borderColor',
        'bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary',
        'px-3 py-2 text-sm ring-offset-bolt-elements-background-depth-1',
        'placeholder:text-bolt-elements-textTertiary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50 resize-y',
        className,
      )}
      {...props}
    />
  );
});

Textarea.displayName = 'Textarea';

export { Textarea };
