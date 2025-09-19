import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { useNavigate } from '@remix-run/react';
import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { Button } from '~/components/ui/Button';
import { LoginDialog } from '~/components/auth/LoginDialog';
import { initializeNetlifyConnection } from '~/lib/stores/netlify';
import { initializeVercelConnection } from '~/lib/stores/vercel';
import { initializeSupabaseConnection } from '~/lib/stores/supabase';
import { gitlabConnectionStore } from '~/lib/stores/gitlabConnection';
import { initializeGitHubConnection } from '~/lib/stores/github';
import { initAuth, isAuthenticated, isAuthLoading } from '~/lib/stores/auth';

export const meta: MetaFunction = () => {
  return [{ title: 'Bolt' }, { name: 'description', content: 'Talk with Bolt, an AI assistant from StackBlitz' }];
};

export const loader = () => json({});

/**
 * Landing page component for Bolt
 * Note: Settings functionality should ONLY be accessed through the sidebar menu.
 * Do not add settings button/panel to this landing page as it was intentionally removed
 * to keep the UI clean and consistent with the design system.
 */
export default function Index() {
  const navigate = useNavigate();
  const authed = useStore(isAuthenticated);
  const authLoading = useStore(isAuthLoading);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [hasChosenGuest, setHasChosenGuest] = useState(false);
  const onboardingSteps = [
    {
      title: 'Create a team',
      description: 'Organise workspaces around products or clients.',
      icon: 'i-ph:users',
    },
    {
      title: 'Invite collaborators',
      description: 'Add owners, admins, and developers with role-based access.',
      icon: 'i-ph:user-plus',
    },
    {
      title: 'Buil & ship features',
      description: 'Track branches, chats, and assignments from a single hub.',
      icon: 'i-ph:rocket',
    },
  ];

  useEffect(() => {
    const initializeConnections = async () => {
      try {
        await Promise.allSettled([
          initAuth(),
          initializeGitHubConnection(),
          gitlabConnectionStore.autoConnect(),
          initializeNetlifyConnection(),
          initializeVercelConnection(),
          initializeSupabaseConnection(),
        ]);
      } catch (error) {
        console.error('Error initializing connections:', error);
      }
    };

    initializeConnections();
  }, []);

  useEffect(() => {
    if (!authLoading && authed) {
      // Check if there's pending chat metadata that needs to be processed
      const pendingChatMetadata = typeof window !== 'undefined' ? sessionStorage.getItem('pendingChatMetadata') : null;

      // If there's pending chat metadata, redirect to the dedicated chat route
      if (pendingChatMetadata) {
        navigate('/chat');
      } else {
        // Otherwise, redirect to projects as usual
        navigate('/projects');
      }
    }
  }, [authLoading, authed, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const guestChosen = window.localStorage.getItem('bolt-diy-guest-chosen');
    setHasChosenGuest(!!guestChosen);
  }, []);

  const handleContinueAsGuest = () => {
    setHasChosenGuest(true);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('bolt-diy-guest-chosen', 'true');
    }
  };

  return (
    <>
      {(() => {
        if (!authLoading && !authed && !hasChosenGuest) {
          return (
            <div className="relative flex h-screen w-full flex-col bg-bolt-elements-background-depth-1 overhead-hidden">
              {/* Full-screen landing page */}
              <BackgroundRays />

              {/* Minimal Heade */}
              <header className="relative z-20 flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="i-ph:squares-four w-6 h-6 text-bolt-elements-item-contentAccent" />
                  <span className="text-lg font-semibold text-bolt-elements-textPrimary">bolt.diy</span>
                </div>
              </header>

              {/* Hero Content */}
              <main className="relative z-10 flex flex-1 items-center justify-center px-6">
                <div className="w-full max-w-4xl text-center space-y-8">
                  {/* Welcome Badge */}
                  <div className="inline-flex items-center gap-2 rounded-full border border-bolt-elements-borderColor/40 bg-bolt-elements-background/20 px-4 py-2 backdrop-blur-sm">
                    <span className="i-ph:sparkle w-4 h-4 text-bolt-elements-item-contentAccent" />
                    <span className="text-sm font-medium text-bolt-elements-textSecondary">Welcome to BoltDIY</span>
                  </div>

                  {/* Main Headline */}
                  <div className="space-y-4">
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-bolt-elements-textPrimary leading-tight">
                      Collaborate on features with your{' '}
                      <span className="bg-gradient-to-r from-bolt-elements-item-contentAccent to-purple-400 bg-clip-text text-transparent">
                        entire team
                      </span>
                    </h1>
                    <p className="text-lg sm:text-xl text-bolt-elements-textSecondary max-w-2xl mx-auto leading-relaxed">
                      Sign in to sync your chats, manage teams, and keep every feature assignment in one place.
                    </p>
                  </div>

                  {/* Primary CTA */}
                  <div className="flex flex-col items-center gap-6">
                    <Button
                      variant="cta"
                      size="lg"
                      className="px-8 py-4 text-base font-semibold h-auto min-w-[200px] justify-between shadow-lg hover:shadow-xl transition-all duration-300"
                      onClick={() => setShowLoginDialog(true)}
                    >
                      <span className="flex items-center gap-3">
                        <span className="i-ph:sign-in w-5 h-5" />
                        <span>Sign In</span>
                      </span>
                      <span className="i-ph:arrow-right w-5 h-5" />
                    </Button>

                    {/* Continue as Guest */}
                    <Button
                      variant="ghost"
                      className="group flex items-center gap-2 text-bolt-elements-textSecondary hover:!text-bolt-elements-borderColorActive transition-colors"
                      onClick={handleContinueAsGuest}
                    >
                      <span className="i-ph:user w-4 h-4" />
                      <span>Continue as guest</span>
                      <span className="i-ph:arrow-right w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </div>

                  {/* Always Visible Onboarding Section */}
                  <div className="mt-16 rounded-2xl border border-bolt-elements-borderColor/30 bg-bolt-elements-background/10 backdrop-blur-sm p-8 max-w-4xl mx-auto">
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-semibold text-bolt-elements-textPrimary mb-2">
                        Getting started is simple
                      </h2>
                      <p className="text-bolt-elements-textSecondary">
                        Follow these steps to unlock collaborate project management.
                      </p>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                      {onboardingSteps.map((step) => (
                        <div
                          key={step.title}
                          className="flex flex-col items-center text-center p-6 rounded-xl border border-bolt-elements-borderColor/20 bg-bolt-elements-background/5 hover:bg-bolt-elements-background/10 transition-colors"
                        >
                          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-bolt-elements-item-backgroundAccent/20 mb-4">
                            <span className={`${step.icon} text-xl text-bolt-elements-item-contentAccent`} />
                          </div>
                          <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">{step.title}</h3>
                          <p className="text-sm text-bolt-elements-textSecondary leading-relaxed">{step.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </main>

              <LoginDialog isOpen={showLoginDialog} onClose={() => setShowLoginDialog(false)} />
            </div>
          );
        }

        return (
          <div className="relative flex h-full w-full flex-col bg-bolt-elements-background-depth-1">
            {/* Regular app with sidebar and chat */}
            <BackgroundRays />
            <Header />
            <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
            <LoginDialog isOpen={showLoginDialog} onClose={() => setShowLoginDialog(false)} />
          </div>
        );
      })()}
    </>
  );
}
