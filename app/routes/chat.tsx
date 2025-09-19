import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { useStore } from '@nanostores/react';
import { useEffect } from 'react';
import { useNavigate } from '@remix-run/react';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import { initializeNetlifyConnection } from '~/lib/stores/netlify';
import { initializeVercelConnection } from '~/lib/stores/vercel';
import { initializeSupabaseConnection } from '~/lib/stores/supabase';
import { gitlabConnectionStore } from '~/lib/stores/gitlabConnection';
import { initializeGitHubConnection } from '~/lib/stores/github';
import { initAuth, isAuthenticated, isAuthLoading } from '~/lib/stores/auth';

export const meta: MetaFunction = () => {
  return [{ title: 'Bolt Chat' }, { name: 'description', content: 'Chat with Bolt AI assistant' }];
};

export const loader = () => json({});

/**
 * Dedicated chat route for authenticated users working on projects.
 * This route bypasses the authentication redirect logic that was preventing
 * feature chat functionality from working properly.
 */
export default function ChatRoute() {
  const navigate = useNavigate();
  const authed = useStore(isAuthenticated);
  const authLoading = useStore(isAuthLoading);

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

  // Redirect unauthenticated users to main page for login/guest flow
  useEffect(() => {
    if (!authLoading && !authed) {
      navigate('/', { replace: true });
    }
  }, [authLoading, authed, navigate]);

  // Show loading during auth check
  if (authLoading) {
    return (
      <div className="relative flex h-full w-full flex-col bg-bolt-elements-background-depth-1">
        <BackgroundRays />
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-bolt-elements-textSecondary">Loading...</div>
        </div>
      </div>
    );
  }

  // Only show chat for authenticated users
  if (!authed) {
    return null; // Will redirect via useEffect above
  }

  return (
    <div className="relative flex h-full w-full flex-col bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
    </div>
  );
}
