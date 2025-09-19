import { useState } from 'react';
import { Eye, EyeOff, LogIn, X } from 'lucide-react';
import { Button } from '~/components/ui/Button';
import { Dialog, DialogRoot, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { Label } from '~/components/ui/Label';
import { login, register, authError, isAuthLoading, clearAuthError } from '~/lib/stores/auth';
import { useStore } from '@nanostores/react';

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type Mode = 'login' | 'register';

export function LoginDialog({ isOpen, onClose }: LoginDialogProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    name: '',
  });

  const error = useStore(authError);
  const loading = useStore(isAuthLoading);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (error) {
      clearAuthError();
    }
  };

  const handleClose = () => {
    setShowPassword(false);
    clearAuthError();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (mode === 'login') {
        await login(formData.email, formData.password);
      } else {
        await register(formData.email, formData.password, formData.username, formData.name);
      }

      handleClose();

      // Reset form
      setFormData({ email: '', password: '', username: '', name: '' });
    } catch (error) {
      console.error('Authentication request failed', error);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    clearAuthError();
  };

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <Dialog showCloseButton={false} className="max-w-md">
        <div style={{ padding: 'var(--bolt-elements-component-padding-lg)' }}>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 'var(--bolt-elements-spacing-2xl)' }}
          >
            <DialogTitle className="text-xl font-semibold">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              disabled={loading}
              className="text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <DialogDescription style={{ marginBottom: 'var(--bolt-elements-spacing-xl)' }}>
            {mode === 'login' ? 'Sign in to your account to continue' : 'Join bolt.diy to manage your projects'}
          </DialogDescription>

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bolt-elements-spacing-xl)' }}
          >
            {/* Email */}
            <div className="flex flex-col" style={{ gap: 'var(--bolt-elements-spacing-sm)' }}>
              <Label htmlFor="login-email" className="text-sm font-medium text-bolt-elements-textPrimary">
                Email
              </Label>
              <Input
                id="login-email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            {/* Username (register only) */}
            {mode === 'register' && (
              <div className="flex flex-col" style={{ gap: 'var(--bolt-elements-spacing-sm)' }}>
                <Label htmlFor="register-username" className="text-sm font-medium text-bolt-elements-textPrimary">
                  Username
                </Label>
                <Input
                  id="register-username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  placeholder="Choose a username"
                  required
                />
              </div>
            )}

            {/* Name (register only) */}
            {mode === 'register' && (
              <div className="flex flex-col" style={{ gap: 'var(--bolt-elements-spacing-sm)' }}>
                <Label htmlFor="register-name" className="text-sm font-medium text-bolt-elements-textPrimary">
                  Full Name
                </Label>
                <Input
                  id="register-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>
            )}

            {/* Password */}
            <div className="flex flex-col" style={{ gap: 'var(--bolt-elements-spacing-sm)' }}>
              <Label htmlFor="login-password" className="text-sm font-medium text-bolt-elements-textPrimary">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Enter your password"
                  className="pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-transparent p-1 text-bolt-elements-textSecondary transition-colors hover:text-bolt-elements-textPrimary"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === 'register' && (
                <p className="text-xs text-bolt-elements-textSecondary">Password must be at least 6 characters long</p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-bolt-elements-status-error-border bg-bolt-elements-status-error-background px-3 py-2">
                <p className="text-sm text-bolt-elements-status-error-text">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button type="submit" variant="primary" size="lg" block disabled={loading}>
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                  {mode === 'login' ? 'Signing In...' : 'Creating Account...'}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <LogIn className="w-4 h-4" />
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                </div>
              )}
            </Button>
          </form>

          {/* Toggle Mode */}
          <div className="text-center" style={{ marginTop: 'var(--bolt-elements-spacing-xl)' }}>
            <p className="text-sm text-bolt-elements-textSecondary">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
              <button
                type="button"
                onClick={toggleMode}
                className="ml-1 bg-transparent font-medium text-bolt-elements-button-primary-text underline-offset-4 hover:underline focus:outline-none"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </Dialog>
    </DialogRoot>
  );
}
