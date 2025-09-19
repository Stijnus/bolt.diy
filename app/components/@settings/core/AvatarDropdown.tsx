import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion } from 'framer-motion';
import { useStore } from '@nanostores/react';
import { useState } from 'react';
import { classNames } from '~/utils/classNames';
import { currentUser } from '~/lib/stores/auth';
import type { TabType } from './types';
import type { User } from '~/components/projects/types';

interface AvatarDropdownProps {
  onSelectTab: (tab: TabType) => void;
}

export const AvatarDropdown = ({ onSelectTab }: AvatarDropdownProps) => {
  const user = useStore(currentUser) as User;
  const [open, setOpen] = useState(false);

  console.log('AvatarDropdown user:', user); // Debug log

  const handleSelectTab = (tab: TabType) => {
    console.log('handleSelectTab called with:', tab);
    setOpen(false); // Close dropdown first
    setTimeout(() => {
      onSelectTab(tab); // Then trigger the tab selection
    }, 100);
  };

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <motion.button
          className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center focus:outline-none hover:ring-2 hover:ring-bolt-elements-borderColor transition-all cursor-pointer"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => console.log('Avatar button clicked!')}
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user?.username || 'Profile'}
              className="w-full h-full rounded-full object-cover"
              loading="eager"
              decoding="sync"
            />
          ) : (
            <div className="w-full h-full rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-600 text-white border-2 border-purple-400 shadow-lg">
              <div className="i-ph:user w-5 h-5 text-white" />
            </div>
          )}
        </motion.button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={classNames(
            'min-w-[240px] z-[9999]',
            'bg-white dark:bg-gray-900',
            'rounded-lg shadow-xl',
            'border border-bolt-elements-borderColor',
            'animate-in fade-in-0 zoom-in-95',
            'py-1',
          )}
          sideOffset={5}
          align="end"
        >
          <div className={classNames('px-4 py-3 flex items-center gap-3', 'border-b border-bolt-elements-borderColor')}>
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-purple-500 to-blue-600 shadow-sm">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user?.username || 'Profile'}
                  className={classNames('w-full h-full', 'object-cover', 'transform-gpu', 'image-rendering-crisp')}
                  loading="eager"
                  decoding="sync"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-medium text-lg">
                  <div className="i-ph:user w-6 h-6" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-bolt-elements-textPrimary truncate">
                {user?.name || user?.username || 'Guest User'}
              </div>
              {user?.email && <div className="text-xs text-bolt-elements-textSecondary truncate">{user.email}</div>}
              {user?.bio && <div className="text-xs text-bolt-elements-textSecondary truncate">{user.bio}</div>}
            </div>
          </div>

          <DropdownMenu.Item
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5',
              'text-sm text-bolt-elements-textPrimary',
              'hover:bg-bolt-elements-button-primary-background',
              'hover:text-bolt-elements-button-primary-text',
              'cursor-pointer transition-all duration-200',
              'outline-none',
              'group',
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Profile clicked from AvatarDropdown');
              handleSelectTab('profile');
            }}
          >
            <div className="i-ph:user-circle w-4 h-4 text-bolt-elements-textSecondary group-hover:text-bolt-elements-button-primary-text transition-colors" />
            Edit Profile
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5',
              'text-sm text-bolt-elements-textPrimary',
              'hover:bg-bolt-elements-button-primary-background',
              'hover:text-bolt-elements-button-primary-text',
              'cursor-pointer transition-all duration-200',
              'outline-none',
              'group',
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Settings clicked from AvatarDropdown');
              handleSelectTab('settings');
            }}
          >
            <div className="i-ph:gear-six w-4 h-4 text-bolt-elements-textSecondary group-hover:text-bolt-elements-button-primary-text transition-colors" />
            Settings
          </DropdownMenu.Item>

          <div className="my-1 border-t border-bolt-elements-borderColor" />

          <DropdownMenu.Item
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5',
              'text-sm text-bolt-elements-textPrimary',
              'hover:bg-bolt-elements-button-primary-background',
              'hover:text-bolt-elements-button-primary-text',
              'cursor-pointer transition-all duration-200',
              'outline-none',
              'group',
            )}
            onClick={() =>
              window.open('https://github.com/stackblitz-labs/bolt.diy/issues/new?template=bug_report.yml', '_blank')
            }
          >
            <div className="i-ph:bug w-4 h-4 text-bolt-elements-textSecondary group-hover:text-bolt-elements-button-primary-text transition-colors" />
            Report Bug
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5',
              'text-sm text-bolt-elements-textPrimary',
              'hover:bg-bolt-elements-button-primary-background',
              'hover:text-bolt-elements-button-primary-text',
              'cursor-pointer transition-all duration-200',
              'outline-none',
              'group',
            )}
            onClick={async () => {
              try {
                const { downloadDebugLog } = await import('~/utils/debugLogger');
                await downloadDebugLog();
              } catch (error) {
                console.error('Failed to download debug log:', error);
              }
            }}
          >
            <div className="i-ph:download w-4 h-4 text-bolt-elements-textSecondary group-hover:text-bolt-elements-button-primary-text transition-colors" />
            Download Debug Log
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5',
              'text-sm text-bolt-elements-textPrimary',
              'hover:bg-bolt-elements-button-primary-background',
              'hover:text-bolt-elements-button-primary-text',
              'cursor-pointer transition-all duration-200',
              'outline-none',
              'group',
            )}
            onClick={() => window.open('https://stackblitz-labs.github.io/bolt.diy/', '_blank')}
          >
            <div className="i-ph:question w-4 h-4 text-bolt-elements-textSecondary group-hover:text-bolt-elements-button-primary-text transition-colors" />
            Help & Documentation
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
