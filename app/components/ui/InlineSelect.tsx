import { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';
import { classNames } from '~/utils/classNames';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface InlineSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  id?: string;
  name?: string;
  placeholder?: string;
}

export function InlineSelect({
  value,
  options,
  onChange,
  disabled,
  className,
  buttonClassName,
  id,
  name,
  placeholder,
}: InlineSelectProps) {
  return (
    <Listbox value={value} onChange={onChange} disabled={disabled} name={name}>
      {({ open }) => (
        <div className={classNames('relative', className)}>
          <Listbox.Button
            className={classNames(
              'w-full rounded-lg border border-bolt-elements-borderColor bg-transparent px-4 py-2 text-left text-sm text-bolt-elements-textPrimary',
              'transition-colors focus:outline-none focus:ring-2 focus:ring-bolt-elements-borderColor focus:ring-offset-2 focus:ring-offset-transparent',
              'disabled:cursor-not-allowed disabled:opacity-50',
              buttonClassName,
            )}
            id={id}
            aria-labelledby={id ? `${id}-label` : undefined}
          >
            <span className="block truncate">
              {options.find((opt) => opt.value === value)?.label ?? placeholder ?? 'Select option'}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <ChevronDown className="h-4 w-4 text-bolt-elements-textSecondary" aria-hidden="true" />
            </span>
          </Listbox.Button>

          <Transition
            as={Fragment}
            show={open}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Listbox.Options className="absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-bolt-elements-borderColor bg-white dark:bg-gray-900 py-1 shadow-xl focus:outline-none">
              {options.map((option) => (
                <Listbox.Option
                  key={option.value}
                  value={option.value}
                  className={({ active, selected }) =>
                    classNames(
                      'relative cursor-pointer select-none px-4 py-2 text-sm transition-colors',
                      active || selected
                        ? 'bg-gray-100 dark:bg-gray-800 text-bolt-elements-textPrimary'
                        : 'text-bolt-elements-textSecondary',
                    )
                  }
                >
                  {({ selected }) => (
                    <div className="flex items-center gap-2">
                      <span
                        className={classNames(
                          'flex-1 truncate',
                          selected ? 'font-medium text-bolt-elements-textPrimary' : '',
                        )}
                      >
                        {option.label}
                      </span>
                      {selected ? <Check className="h-4 w-4 text-green-500" /> : null}
                    </div>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      )}
    </Listbox>
  );
}
