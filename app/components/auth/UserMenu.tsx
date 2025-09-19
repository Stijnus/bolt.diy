import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, Settings, ChevronDown, Users } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { useNavigate } from '@remix-run/react';
import { currentUser, isAuthenticated, logout, initAuth } from '~/lib/stores/auth';
import { UserSummary } from '~/components/ui/UserSummary';

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const user = useStore(currentUser);
  const authenticated = useStore(isAuthenticated);

  useEffect(() => {
    initAuth().catch((error) => {
      console.error('Failed to initialize auth state:', error);
    });
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!authenticated || !user) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-bolt-elements-background-depth-3 transition-colors"
      >
        {/* User Avatar */}
        <div className="w-8 h-8 rounded-full bg-bolt-elements-button-primary-background flex items-center justify-center text-sm font-medium text-bolt-elements-button-primary-text">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            getInitials(user.name)
          )}
        </div>

        {/* User Info */}
        <div className="hidden md:block text-left">
          <div className="text-sm font-medium text-bolt-elements-textPrimary">{user.name}</div>
          <div className="text-xs text-bolt-elements-textSecondary">@{user.username}</div>
        </div>

        <ChevronDown className="w-4 h-4 text-bolt-elements-textSecondary" />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full mt-2 w-64 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg shadow-lg z-50"
          >
            {/* User Info Header */}
            <div className="p-4 border-b border-bolt-elements-borderColor">
              <UserSummary user={user} showEmail showUsername className="gap-3" />
            </div>

            {/* Menu Items */}
            <div className="p-2">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/settings/profile');
                }}
                className="w-full flex items-center gap-3 p-2 text-left hover:bg-bolt-elements-background-depth-3 rounded-md transition-colors"
              >
                <User className="w-4 h-4 text-bolt-elements-textSecondary" />
                <span className="text-sm text-bolt-elements-textPrimary">Profile Settings</span>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/settings');
                }}
                className="w-full flex items-center gap-3 p-2 text-left hover:bg-bolt-elements-background-depth-3 rounded-md transition-colors"
              >
                <Settings className="w-4 h-4 text-bolt-elements-textSecondary" />
                <span className="text-sm text-bolt-elements-textPrimary">Settings</span>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/teams');
                }}
                className="w-full flex items-center gap-3 p-2 text-left hover:bg-bolt-elements-background-depth-3 rounded-md transition-colors"
              >
                <Users className="w-4 h-4 text-bolt-elements-textSecondary" />
                <span className="text-sm text-bolt-elements-textPrimary">Teams</span>
              </button>

              <hr className="my-2 border-bolt-elements-borderColor" />

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-2 text-left hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Sign Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
