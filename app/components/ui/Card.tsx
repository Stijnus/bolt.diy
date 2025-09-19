import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { classNames } from '~/utils/classNames';

const cardVariants = cva('text-bolt-elements-textPrimary shadow-sm transition-all duration-300', {
  variants: {
    variant: {
      default: 'rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1',
      blue: 'card-blue',
      purple: 'card-purple',
      green: 'card-green',
      neutral: 'card-neutral',
    },
    size: {
      default: 'p-6',
      sm: 'p-4',
      lg: 'p-8',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export interface CardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

const Card = forwardRef<HTMLDivElement, CardProps>(({ className, variant, size, ...props }, ref) => {
  return <div ref={ref} className={classNames(cardVariants({ variant, size }), className)} {...props} />;
});
Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => {
  return <div ref={ref} className={classNames('flex flex-col space-y-1.5 p-6', className)} {...props} />;
});
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={classNames('text-2xl font-semibold leading-none tracking-tight', className)}
        {...props}
      />
    );
  },
);
CardTitle.displayName = 'CardTitle';

const CardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    return <p ref={ref} className={classNames('text-sm text-bolt-elements-textSecondary', className)} {...props} />;
  },
);
CardDescription.displayName = 'CardDescription';

const CardContent = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => {
  return <div ref={ref} className={classNames('p-6 pt-0', className)} {...props} />;
});
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={classNames('flex items-center p-6 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

const IconContainer = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: 'blue' | 'purple' | 'green' | 'neutral' }
>(({ className, variant = 'blue', ...props }, ref) => {
  const variantClasses = {
    blue: 'icon-container-blue',
    purple: 'icon-container-purple',
    green: 'icon-container-green',
    neutral: 'icon-container-neutral',
  };

  return <div ref={ref} className={classNames(variantClasses[variant], className)} {...props} />;
});
IconContainer.displayName = 'IconContainer';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, IconContainer };
