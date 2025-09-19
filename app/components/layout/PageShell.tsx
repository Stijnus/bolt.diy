import type { ReactNode } from 'react';
import { Link } from '@remix-run/react';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { classNames } from '~/utils/classNames';

interface Breadcrumb {
  label: string;
  to?: string;
}

interface PageShellProps {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
  children: ReactNode;
  maxWidthClassName?: string;
  contentClassName?: string;
}

export function PageShell({
  title,
  description,
  breadcrumbs = [],
  actions,
  children,
  maxWidthClassName = 'max-w-7xl',
  contentClassName,
}: PageShellProps) {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-bolt-elements-background via-bolt-elements-background to-purple-50/30">
      <div className="absolute inset-0 overflow-hidden">
        <BackgroundRays />
      </div>
      <div className={classNames('relative z-10 mx-auto w-full px-6 py-10 space-y-10', maxWidthClassName)}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            {breadcrumbs.length > 0 && (
              <p className="text-sm text-bolt-elements-textSecondary">
                {breadcrumbs.map((crumb, index) => {
                  const isLast = index === breadcrumbs.length - 1;

                  if (crumb.to && !isLast) {
                    return (
                      <span key={crumb.label}>
                        <Link to={crumb.to} className="hover:underline">
                          {crumb.label}
                        </Link>
                        <span className="px-1">/</span>
                      </span>
                    );
                  }

                  return (
                    <span key={crumb.label} className={isLast ? '' : 'mr-1'}>
                      {crumb.label}
                      {!isLast && <span className="px-1">/</span>}
                    </span>
                  );
                })}
              </p>
            )}
            <h1 className="text-3xl font-semibold text-bolt-elements-textPrimary">{title}</h1>
            {description && <p className="text-sm text-bolt-elements-textSecondary sm:text-base">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 sm:gap-4">{actions}</div>}
        </div>

        <div className={classNames('space-y-6', contentClassName)}>{children}</div>
      </div>
    </div>
  );
}
