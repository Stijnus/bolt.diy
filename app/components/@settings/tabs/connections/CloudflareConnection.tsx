import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import {
  cloudflareConnection,
  connectCloudflare,
  disconnectCloudflare,
  setCloudflareToken,
  setCloudflareAccountId,
  isConnectingCloudflare,
} from '~/lib/stores/cloudflare';
import type { CloudflareUser } from '~/lib/stores/cloudflare'; // Assuming User type is exported
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input'; // Assuming Input component exists
import { Label } from '~/components/ui/Label'; // Assuming Label component exists
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '~/components/ui/Card'; // Assuming Card components exist

// Cloudflare Logo SVG Component
const CloudflareLogo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M3.086 12.001c0 2.083.126 3.23.803 4.302.762 1.204 1.99 1.962 3.336 2.177 1.32.212 5.343.212 6.775 0 1.346-.215 2.574-.973 3.337-2.177.677-1.072.802-2.219.802-4.302s-.125-3.23-.802-4.302c-.763-1.204-1.991-1.962-3.337-2.177-1.432-.212-5.455-.212-6.775 0-1.346.215-2.574.973-3.336 2.177C3.212 8.77 3.086 9.918 3.086 12.001Zm16.938 2.436c.13-.418.195-.856.195-1.314 0-.562-.078-1.012-.234-1.446-.21-.593-.617-1.088-1.223-1.486-.605-.397-1.325-.596-2.16-.596-.838 0-1.556.199-2.157.596-.601.398-1.01.893-1.221 1.486-.156.434-.233.884-.233 1.446 0 .458.065.896.195 1.314.131.419.329.774.596 1.064.267.291.582.502.946.632.364.131.747.196 1.148.196s.784-.065 1.148-.196c.364-.13.679-.341.946-.632.267-.29.465-.645.596-1.064Zm-4.959-3.264c.208-.013.416-.02.624-.02s.416.007.623.02c.435.027.802.168 1.099.425.299.256.448.611.448 1.064s-.149.808-.448 1.064c-.297.257-.664.398-1.099.425-.207.013-.415.02-.623.02s-.416-.007-.624-.02c-.434-.027-.802-.168-1.098-.425-.299-.256-.448-.611-.448-1.064s.149-.808.448-1.064c.296-.257.664-.398 1.098-.425Z"/>
  </svg>
);


export default function CloudflareConnection() {
  const connection = useStore(cloudflareConnection);
  const isConnecting = useStore(isConnectingCloudflare);

  const [tokenInput, setTokenInput] = useState('');
  const [accountIdInput, setAccountIdInput] = useState('');

  useEffect(() => {
    // Initialize input fields if connection data exists (e.g., loaded from localStorage)
    if (connection.token) {
      setTokenInput(connection.token);
    }
    if (connection.accountId) {
      setAccountIdInput(connection.accountId);
    }
  }, [connection.token, connection.accountId]);

  const handleConnect = async () => {
    if (!tokenInput) {
      toast.error('Please enter a Cloudflare API Token.');
      return;
    }
    if (!accountIdInput) {
      toast.error('Please enter a Cloudflare Account ID.');
      return;
    }

    // For now, we'll use the connectCloudflare action which simulates user fetching.
    // If user details were needed upfront, we might call setCloudflareToken and setCloudflareAccountId first,
    // then trigger a separate action to validate and fetch user details.
    await connectCloudflare(tokenInput, accountIdInput);
    // No need to call setCloudflareToken or setCloudflareAccountId here as connectCloudflare handles it.
  };

  const handleDisconnect = () => {
    disconnectCloudflare();
    setTokenInput('');
    setAccountIdInput('');
    toast.info('Disconnected from Cloudflare.');
  };

  return (
    <Card className="bg-bolt-elements-background dark:bg-bolt-elements-background border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[#F38020]"> {/* Cloudflare Orange */}
            <CloudflareLogo />
          </div>
          <CardTitle className="text-lg font-medium text-bolt-elements-textPrimary">Cloudflare</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connection.user ? (
          <>
            <CardDescription className="text-sm text-bolt-elements-textSecondary">
              Connect your Cloudflare account to manage your resources.
            </CardDescription>
            <div>
              <Label htmlFor="cloudflareToken" className="block text-sm text-bolt-elements-textSecondary mb-1">
                API Token
              </Label>
              <Input
                id="cloudflareToken"
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Enter your Cloudflare API Token"
                className={classNames(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                  'border border-[#E5E5E5] dark:border-[#333333]',
                  'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive',
                  'disabled:opacity-50',
                )}
                disabled={isConnecting}
              />
               <div className="mt-1 text-xs text-bolt-elements-textSecondary">
                <a
                  href="https://dash.cloudflare.com/profile/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bolt-elements-borderColorActive hover:underline inline-flex items-center gap-1"
                >
                  Create an API Token (e.g., with "Edit Workers" and "Account Settings Read" permissions)
                  <div className="i-ph:arrow-square-out w-3 h-3" />
                </a>
              </div>
            </div>
            <div>
              <Label htmlFor="cloudflareAccountId" className="block text-sm text-bolt-elements-textSecondary mb-1">
                Account ID
              </Label>
              <Input
                id="cloudflareAccountId"
                type="text"
                value={accountIdInput}
                onChange={(e) => setAccountIdInput(e.target.value)}
                placeholder="Enter your Cloudflare Account ID"
                className={classNames(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                  'border border-[#E5E5E5] dark:border-[#333333]',
                  'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive',
                  'disabled:opacity-50',
                )}
                disabled={isConnecting}
              />
              <div className="mt-1 text-xs text-bolt-elements-textSecondary">
                Find your Account ID in the Cloudflare dashboard URL or on the right sidebar of a domain's overview page.
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
              <div className="i-ph:check-circle w-4 h-4 text-green-500" />
              <span>
                Connected as <span className="font-medium text-bolt-elements-textPrimary">{connection.user.email}</span>
              </span>
            </div>
            {/* Future: Display Cloudflare specific stats or info here */}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-start gap-2">
        {!connection.user ? (
          <Button
            onClick={handleConnect}
            disabled={isConnecting || !tokenInput || !accountIdInput}
            className={classNames(
              'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
              'bg-[#303030] text-white',
              'hover:bg-[#F38020] hover:text-white', // Cloudflare Orange for hover
              'disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200',
              'transform active:scale-95',
            )}
          >
            {isConnecting ? (
              <>
                <div className="i-ph:spinner-gap animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <div className="i-ph:plug-charging w-4 h-4" />
                Connect
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleDisconnect}
            variant="destructive"
            className={classNames(
              'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
              // Destructive variant handles styling
            )}
          >
            <div className="i-ph:plug w-4 h-4" />
            Disconnect
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
