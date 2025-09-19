import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import type { User } from '~/components/projects/types';
import { currentUser } from '~/lib/stores/auth';

interface UserSummaryProps {
  user?: User | null;
  showEmail?: boolean;
  showUsername?: boolean;
  showAvatar?: boolean;
  orientation?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses: Record<NonNullable<UserSummaryProps['size']>, string> = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

export function UserSummary({
  user: providedUser,
  showEmail = true,
  showUsername = true,
  showAvatar = true,
  orientation = 'horizontal',
  size = 'md',
  className,
}: UserSummaryProps) {
  const storeUser = useStore(currentUser);
  const user = providedUser ?? storeUser;

  if (!user) {
    return null;
  }

  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={classNames(
        'flex items-center gap-3',
        orientation === 'vertical' && 'flex-col items-start gap-2',
        className,
      )}
    >
      {showAvatar && (
        <div
          className={classNames(
            'flex items-center justify-center rounded-full bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text font-medium overflow-hidden',
            sizeClasses[size],
          )}
        >
          {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : initials}
        </div>
      )}
      <div className={classNames('min-w-0 space-y-0.5', orientation === 'vertical' ? 'text-left' : 'flex-1')}>
        <p className="text-sm font-medium text-bolt-elements-textPrimary truncate">{user.name}</p>
        {showEmail && user.email && <p className="text-xs text-bolt-elements-textSecondary truncate">{user.email}</p>}
        {showUsername && user.username && (
          <p className="text-xs text-bolt-elements-textSecondary truncate">@{user.username}</p>
        )}
      </div>
    </div>
  );
}
