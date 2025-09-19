import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { classNames } from '~/utils/classNames';

const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium',
    'transition-colors duration-150 ease-out shadow-sm',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        default: classNames(
          'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text',
          'border border-transparent hover:bg-bolt-elements-button-primary-backgroundHover',
        ),
        primary: classNames(
          'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text',
          'border border-transparent hover:bg-bolt-elements-button-primary-backgroundHover',
        ),
        secondary: classNames(
          'bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary',
          'border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3',
        ),
        destructive: classNames(
          'bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text',
          'border border-bolt-elements-button-danger-border hover:bg-bolt-elements-button-danger-backgroundHover',
        ),
        outline: classNames(
          'bg-transparent text-bolt-elements-textPrimary',
          'border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-2',
        ),
        ghost: classNames(
          'bg-transparent text-bolt-elements-textSecondary',
          'border border-transparent hover:bg-bolt-elements-background-depth-1 hover:text-bolt-elements-textPrimary',
        ),
        link: 'bg-transparent text-bolt-elements-button-primary-text underline underline-offset-4 hover:text-bolt-elements-button-primary-text/80',
        cta: classNames(
          'text-white font-semibold tracking-wide',
          'bg-[linear-gradient(135deg,rgba(138,95,255,0.85),rgba(69,28,155,0.92))]',
          'border border-[rgba(138,95,255,0.65)] hover:border-[rgba(170,127,255,0.85)]',
          'shadow-[0_10px_35px_rgba(138,95,255,0.35)] hover:shadow-[0_12px_40px_rgba(170,127,255,0.45)]',
        ),
        sidebar: classNames(
          'bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary',
          'border border-bolt-elements-borderColor/60 hover:border-bolt-elements-borderColor',
          'hover:bg-bolt-elements-background-depth-3/90 transition-colors duration-150',
        ),
        'sidebar-nav': classNames(
          'group relative bg-transparent text-bolt-elements-textSecondary',
          'border border-bolt-elements-borderColor/40 hover:border-bolt-elements-borderColorActive/50',
          'hover:bg-bolt-elements-background-depth-2/50 hover:text-bolt-elements-textPrimary',
          'transition-all duration-200 ease-out',
          'hover:shadow-sm hover:shadow-bolt-elements-borderColorActive/20',
          'hover:scale-[1.01] active:scale-[0.99]',
        ),
        'sidebar-action': classNames(
          'group relative bg-transparent text-bolt-elements-textSecondary',
          'border border-bolt-elements-borderColor/50 hover:border-bolt-elements-borderColorActive/60',
          'hover:bg-bolt-elements-background-depth-2/50 hover:text-bolt-elements-textPrimary',
          'transition-all duration-150 ease-out',
          'hover:shadow-sm hover:shadow-bolt-elements-borderColor/30',
          'hover:scale-[1.02] active:scale-[0.98]',
          'focus:ring-2 focus:ring-bolt-elements-borderColorActive/30 focus:ring-offset-1',
        ),
        'sidebar-profile': classNames(
          'group relative bg-gradient-to-br from-bolt-elements-background-depth-1 to-bolt-elements-background-depth-2',
          'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
          'border border-bolt-elements-borderColor/60 hover:border-bolt-elements-borderColorActive/70',
          'hover:bg-gradient-to-br hover:from-bolt-elements-background-depth-2 hover:to-bolt-elements-background-depth-3',
          'transition-all duration-200 ease-out',
          'hover:shadow-md hover:shadow-bolt-elements-borderColor/25',
          'hover:scale-[1.01] active:scale-[0.99]',
          'ring-1 ring-bolt-elements-borderColor/20',
        ),
      },
      size: {
        default: 'h-9 px-4 text-sm',
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9 p-0',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      block: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, children, ...props }, ref) => {
    const composedClassName = classNames(buttonVariants({ variant, size, block }), className);

    if (asChild && React.isValidElement(children)) {
      const childElement = children as React.ReactElement<Record<string, unknown>>;
      const existingClassName = (childElement.props as { className?: string })?.className;

      return React.cloneElement(childElement, {
        ...(props as Record<string, unknown>),
        className: classNames(composedClassName, existingClassName),
        ref: ref as React.Ref<unknown>,
      } as Partial<Record<string, unknown>> & React.Attributes);
    }

    return (
      <button className={composedClassName} ref={ref} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
