import React, { useState, useCallback, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { classNames } from '~/utils/classNames';
import { currentUser, authSession } from '~/lib/stores/auth';
import { UserService } from '~/lib/services/userService';
import { toast } from 'react-toastify';
import { debounce } from '~/utils/debounce';
import type { User } from '~/components/projects/types';

export default function ProfileTab() {
  const user = useStore(currentUser);
  const session = useStore(authSession);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Local state for form data
  const [formData, setFormData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    email: user?.email || '',
    bio: user?.bio || '',
    avatar: user?.avatar || '',
  });

  // Update form data when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        bio: user.bio || '',
        avatar: user.avatar || '',
      });
    }
  }, [user]);

  // Create debounced update functions
  const debouncedUpdate = useCallback(
    debounce(async (updates: Partial<User>) => {
      if (!user) {
        return;
      }

      try {
        setIsSaving(true);
        await UserService.updateUser(user.id, updates);

        // Update the session with new user data
        if (session) {
          authSession.set({
            ...session,
            user: { ...user, ...updates },
          });
        }

        toast.success('Profile updated successfully');
      } catch (error) {
        console.error('Failed to update profile:', error);
        toast.error('Failed to update profile');
      } finally {
        setIsSaving(false);
      }
    }, 1000),
    [user, session],
  );

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file || !user) {
      return;
    }

    try {
      setIsUploading(true);

      // Convert the file to base64
      const reader = new FileReader();

      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const newFormData = { ...formData, avatar: base64String };
        setFormData(newFormData);

        try {
          await UserService.updateUser(user.id, { avatar: base64String });

          if (session) {
            authSession.set({
              ...session,
              user: { ...user, avatar: base64String },
            });
          }

          toast.success('Profile picture updated');
        } catch (error) {
          console.error('Error uploading avatar:', error);
          toast.error('Failed to update profile picture');
        }
      };

      reader.onerror = () => {
        console.error('Error reading file:', reader.error);
        toast.error('Failed to read file');
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to update profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Debounce the server update
    debouncedUpdate({ [field]: value });
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center py-12">
        <p className="text-bolt-elements-textSecondary">Please log in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-6">
        {/* Personal Information Section */}
        <div>
          {/* Avatar Upload */}
          <div className="flex items-start gap-6 mb-8">
            <div
              className={classNames(
                'w-24 h-24 rounded-full overflow-hidden',
                'bg-bolt-elements-bg-depth-2',
                'flex items-center justify-center',
                'ring-1 ring-bolt-elements-borderColor',
                'relative group',
                'transition-all duration-300 ease-out',
                'hover:ring-bolt-elements-focus/30',
                'hover:shadow-lg hover:shadow-bolt-elements-focus/10',
              )}
            >
              {formData.avatar ? (
                <img
                  src={formData.avatar}
                  alt="Profile"
                  className={classNames(
                    'w-full h-full object-cover',
                    'transition-all duration-300 ease-out',
                    'group-hover:scale-105 group-hover:brightness-90',
                  )}
                />
              ) : (
                <div className="i-ph:user-circle-fill w-16 h-16 text-bolt-elements-textTertiary transition-colors group-hover:text-bolt-elements-focus/70 transform -translate-y-1" />
              )}

              <label
                className={classNames(
                  'absolute inset-0',
                  'flex items-center justify-center',
                  'bg-black/0 group-hover:bg-black/40',
                  'cursor-pointer transition-all duration-300 ease-out',
                  isUploading ? 'cursor-wait' : '',
                )}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={isUploading}
                />
                {isUploading ? (
                  <div className="i-ph:spinner-gap w-6 h-6 text-white animate-spin" />
                ) : (
                  <div className="i-ph:camera-plus w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out transform group-hover:scale-110" />
                )}
              </label>
            </div>

            <div className="flex-1 pt-1">
              <label className="block text-base font-medium text-bolt-elements-textPrimary mb-1">Profile Picture</label>
              <p className="text-sm text-bolt-elements-textSecondary">Upload a profile picture or avatar</p>
            </div>
          </div>

          {/* Full Name Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">Full Name</label>
            <div className="relative group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                <div className="i-ph:user w-5 h-5 text-bolt-elements-textTertiary transition-colors group-focus-within:text-bolt-elements-focus" />
              </div>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={classNames(
                  'w-full pl-11 pr-4 py-2.5 rounded-xl',
                  'bg-bolt-elements-input-background',
                  'border border-bolt-elements-input-border',
                  'text-bolt-elements-input-text',
                  'placeholder-bolt-elements-input-placeholder',
                  'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus/50 focus:border-bolt-elements-focus/50',
                  'transition-all duration-300 ease-out',
                )}
                placeholder="Enter your full name"
              />
            </div>
          </div>

          {/* Username Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">Username</label>
            <div className="relative group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                <div className="i-ph:at w-5 h-5 text-bolt-elements-textTertiary transition-colors group-focus-within:text-bolt-elements-focus" />
              </div>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className={classNames(
                  'w-full pl-11 pr-4 py-2.5 rounded-xl',
                  'bg-bolt-elements-input-background',
                  'border border-bolt-elements-input-border',
                  'text-bolt-elements-input-text',
                  'placeholder-bolt-elements-input-placeholder',
                  'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus/50 focus:border-bolt-elements-focus/50',
                  'transition-all duration-300 ease-out',
                )}
                placeholder="Enter your username"
              />
            </div>
          </div>

          {/* Email Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">Email Address</label>
            <div className="relative group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                <div className="i-ph:envelope w-5 h-5 text-bolt-elements-textTertiary transition-colors group-focus-within:text-bolt-elements-focus" />
              </div>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={classNames(
                  'w-full pl-11 pr-4 py-2.5 rounded-xl',
                  'bg-bolt-elements-input-background',
                  'border border-bolt-elements-input-border',
                  'text-bolt-elements-input-text',
                  'placeholder-bolt-elements-input-placeholder',
                  'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus/50 focus:border-bolt-elements-focus/50',
                  'transition-all duration-300 ease-out',
                )}
                placeholder="Enter your email address"
              />
            </div>
          </div>

          {/* Bio Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">Bio</label>
            <div className="relative group">
              <div className="absolute left-3.5 top-3">
                <div className="i-ph:text-aa w-5 h-5 text-bolt-elements-textTertiary transition-colors group-focus-within:text-bolt-elements-focus" />
              </div>
              <textarea
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                className={classNames(
                  'w-full pl-11 pr-4 py-2.5 rounded-xl',
                  'bg-bolt-elements-input-background',
                  'border border-bolt-elements-input-border',
                  'text-bolt-elements-input-text',
                  'placeholder-bolt-elements-input-placeholder',
                  'focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus/50 focus:border-bolt-elements-focus/50',
                  'transition-all duration-300 ease-out',
                  'resize-none',
                  'h-32',
                )}
                placeholder="Tell us about yourself"
              />
            </div>
          </div>

          {/* Account Information */}
          <div className="mb-8 p-6 rounded-xl bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
            <h3 className="text-sm font-medium text-bolt-elements-textPrimary mb-4">Account Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-bolt-elements-textSecondary">Account ID:</span>
                <span className="ml-2 font-mono text-bolt-elements-textPrimary">{user.id}</span>
              </div>
              <div>
                <span className="text-bolt-elements-textSecondary">Account Status:</span>
                <span
                  className={classNames(
                    'ml-2 px-2 py-1 rounded-full text-xs font-medium',
                    user.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
                  )}
                >
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <span className="text-bolt-elements-textSecondary">Email Verified:</span>
                <span
                  className={classNames(
                    'ml-2 px-2 py-1 rounded-full text-xs font-medium',
                    user.emailVerified
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
                  )}
                >
                  {user.emailVerified ? 'Verified' : 'Pending'}
                </span>
              </div>
              <div>
                <span className="text-bolt-elements-textSecondary">Member Since:</span>
                <span className="ml-2 text-bolt-elements-textPrimary">
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
              {user.lastLoginAt && (
                <div>
                  <span className="text-bolt-elements-textSecondary">Last Login:</span>
                  <span className="ml-2 text-bolt-elements-textPrimary">
                    {new Date(user.lastLoginAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Save Status */}
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Saving changes...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
