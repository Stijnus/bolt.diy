import { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { UserService } from '~/lib/services/userService';
import type { User as UserType } from '~/components/projects/types';

interface UserDisplayProps {
  userId: string;
  showName?: boolean;
  showUsername?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function UserDisplay({
  userId,
  showName = true,
  showUsername = false,
  size = 'sm',
  className = '',
}: UserDisplayProps) {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, [userId]);

  const loadUser = async () => {
    setLoading(true);

    try {
      const userData = await UserService.getUserById(userId);
      setUser(userData);
    } catch (error) {
      console.error('Failed to load user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'xs':
        return {
          avatar: 'w-4 h-4 text-xs',
          text: 'text-xs',
          gap: 'gap-1',
        };
      case 'sm':
        return {
          avatar: 'w-5 h-5 text-xs',
          text: 'text-sm',
          gap: 'gap-1.5',
        };
      case 'md':
        return {
          avatar: 'w-8 h-8 text-sm',
          text: 'text-base',
          gap: 'gap-2',
        };
      case 'lg':
        return {
          avatar: 'w-10 h-10 text-base',
          text: 'text-lg',
          gap: 'gap-3',
        };
      default:
        return {
          avatar: 'w-5 h-5 text-xs',
          text: 'text-sm',
          gap: 'gap-1.5',
        };
    }
  };

  const sizeClasses = getSizeClasses();

  if (loading) {
    return (
      <div className={`flex items-center ${sizeClasses.gap} ${className}`}>
        <div className={`${sizeClasses.avatar} rounded-full bg-gray-200 animate-pulse`} />
        {showName && <div className={`h-4 bg-gray-200 rounded animate-pulse w-16`} />}
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`flex items-center ${sizeClasses.gap} text-bolt-elements-textSecondary ${className}`}>
        <User
          className={`${sizeClasses.avatar.replace('text-xs', '').replace('text-sm', '').replace('text-base', '')} text-bolt-elements-textSecondary`}
        />
        {showName && <span className={sizeClasses.text}>Unknown User</span>}
      </div>
    );
  }

  return (
    <div className={`flex items-center ${sizeClasses.gap} ${className}`}>
      {/* User Avatar */}
      <div
        className={`${sizeClasses.avatar} rounded-full bg-bolt-elements-button-primary-background flex items-center justify-center font-medium text-bolt-elements-button-primary-text flex-shrink-0`}
      >
        {user.avatar ? (
          <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          getInitials(user.name)
        )}
      </div>

      {/* User Info */}
      {(showName || showUsername) && (
        <div className="flex flex-col min-w-0">
          {showName && (
            <span className={`${sizeClasses.text} font-medium text-bolt-elements-textPrimary truncate`}>
              {user.name}
            </span>
          )}
          {showUsername && (
            <span className={`text-xs text-bolt-elements-textSecondary truncate`}>@{user.username}</span>
          )}
        </div>
      )}
    </div>
  );
}

interface UserAvatarOnlyProps {
  userId: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
}

export function UserAvatarOnly({ userId, size = 'sm', className = '', title }: UserAvatarOnlyProps) {
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, [userId]);

  const loadUser = async () => {
    setLoading(true);

    try {
      const userData = await UserService.getUserById(userId);
      setUser(userData);
    } catch (error) {
      console.error('Failed to load user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getSizeClass = () => {
    switch (size) {
      case 'xs':
        return 'w-4 h-4 text-xs';
      case 'sm':
        return 'w-5 h-5 text-xs';
      case 'md':
        return 'w-8 h-8 text-sm';
      case 'lg':
        return 'w-10 h-10 text-base';
      default:
        return 'w-5 h-5 text-xs';
    }
  };

  const sizeClass = getSizeClass();

  if (loading) {
    return <div className={`${sizeClass} rounded-full bg-gray-200 animate-pulse ${className}`} />;
  }

  if (!user) {
    return (
      <div className={`${sizeClass} rounded-full bg-gray-300 flex items-center justify-center ${className}`}>
        <User className={`w-3 h-3 text-gray-500`} />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-bolt-elements-button-primary-background flex items-center justify-center font-medium text-bolt-elements-button-primary-text flex-shrink-0 ${className}`}
      title={title || user.name}
    >
      {user.avatar ? (
        <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
      ) : (
        getInitials(user.name)
      )}
    </div>
  );
}
