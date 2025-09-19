import { memo, type ComponentPropsWithoutRef } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { classNames } from '~/utils/classNames';

type SwitchProps = ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>;

export const Switch = memo(({ className, ...props }: SwitchProps) => {
  return (
    <SwitchPrimitive.Root
      className={classNames(
        'relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full border border-bolt-elements-borderColor/60 bg-gray-600 dark:bg-gray-700',
        'transition-all duration-200 ease-out shadow-inner shadow-black/20',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bolt-elements-background-depth-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-[rgba(154,119,255,0.75)] data-[state=checked]:bg-[linear-gradient(135deg,rgba(163,118,255,0.92),rgba(103,58,255,0.85))] data-[state=checked]:shadow-[0_8px_18px_rgba(129,83,255,0.35)]',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={classNames(
          'pointer-events-none block h-5 w-5 rounded-full border border-bolt-elements-borderColor/40 bg-gray-300 dark:bg-gray-400',
          'shadow-[0_4px_12px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-out',
          'translate-x-0.5 data-[state=checked]:translate-x-[1.375rem]',
          'data-[state=checked]:border-transparent data-[state=checked]:bg-white data-[state=checked]:shadow-[0_6px_16px_rgba(129,83,255,0.45)]',
          'will-change-transform',
        )}
      />
    </SwitchPrimitive.Root>
  );
});
