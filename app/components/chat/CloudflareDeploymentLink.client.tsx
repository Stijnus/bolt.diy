import { useStore } from '@nanostores/react';
import { cloudflareConnection } from '~/lib/stores/cloudflare';
import { chatId } from '~/lib/persistence/useChatHistory';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useEffect, useState } from 'react';

// Helper to construct a Pages project URL (this might not be the final deployment URL)
// const getPagesProjectUrl = (projectName: string) => `https://${projectName}.pages.dev`;

export function CloudflareDeploymentLink() {
  const connection = useStore(cloudflareConnection);
  const currentChatId = useStore(chatId);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchDeploymentData() {
      if (!connection.token || !connection.accountId || !currentChatId) {
        setDeploymentUrl(null);
        return;
      }

      setIsLoading(true);
      // Attempt to get the project name/ID stored by useCloudflareDeploy
      const storedProjectName = localStorage.getItem(`cloudflare-project-${currentChatId}`);

      if (!storedProjectName) {
        // If no project is stored, maybe a direct URL was stored from a previous deployment for this session
        const storedUrl = localStorage.getItem(`cloudflare-deploy-url-${currentChatId}`);
        if (storedUrl) {
            setDeploymentUrl(storedUrl);
        } else {
            setDeploymentUrl(null);
        }
        setIsLoading(false);
        return;
      }

      try {
        // Fetch the specific project details to get its latest deployment or main URL
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${connection.accountId}/pages/projects/${storedProjectName}`,
          {
            headers: {
              Authorization: `Bearer ${connection.token}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (!response.ok) {
          console.error(`Failed to fetch Cloudflare project ${storedProjectName}: ${response.status}`);
          // Fallback: try to construct a URL if the project name itself is a valid subdomain
          // This is often the case, e.g., myproject.pages.dev
          // setDeploymentUrl(getPagesProjectUrl(storedProjectName));
          // For more reliability, we should rely on the API response or a stored URL.
          // If fetch fails, and no direct URL is stored, we can't show a link.
          const storedUrl = localStorage.getItem(`cloudflare-deploy-url-${currentChatId}`);
           if (storedUrl) {
               setDeploymentUrl(storedUrl);
           } else {
              setDeploymentUrl(null); // Or try constructing from project name as a last resort
           }
          return;
        }

        const projectData = (await response.json()) as {
          result: {
            subdomain: string; // e.g., "myproject-abc.pages.dev"
            latest_deployment?: { url: string }; // This is the most reliable URL
            canonical_deployment?: { url: string };
            name: string;
          };
        };

        if (projectData.result) {
          if (projectData.result.latest_deployment?.url) {
            setDeploymentUrl(projectData.result.latest_deployment.url);
          } else if (projectData.result.subdomain) {
            // The subdomain from CF is usually projectname.pages.dev, already a URL component
            setDeploymentUrl(`https://${projectData.result.subdomain}`);
          } else {
            // Fallback if somehow subdomain is also missing
            // setDeploymentUrl(getPagesProjectUrl(projectData.result.name));
             const storedUrl = localStorage.getItem(`cloudflare-deploy-url-${currentChatId}`);
             if (storedUrl) {
                 setDeploymentUrl(storedUrl);
             }
          }
        } else {
            const storedUrl = localStorage.getItem(`cloudflare-deploy-url-${currentChatId}`);
            if (storedUrl) {
                setDeploymentUrl(storedUrl);
            }
        }
      } catch (err) {
        console.error('Error fetching Cloudflare deployment data:', err);
        const storedUrl = localStorage.getItem(`cloudflare-deploy-url-${currentChatId}`);
        if (storedUrl) {
            setDeploymentUrl(storedUrl);
        } else {
            setDeploymentUrl(null);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchDeploymentData();
    // Re-fetch if connection details change, though project ID is tied to chat ID.
  }, [connection.token, connection.accountId, currentChatId]);


  if (!deploymentUrl && !isLoading) {
    return null; // Don't show anything if no URL and not loading
  }

  if (isLoading) {
    return (
        <div className="inline-flex items-center justify-center w-8 h-8 rounded text-bolt-elements-textSecondary">
            <div className="i-svg-spinners:90-ring-with-bg w-4 h-4 animate-pulse" />
        </div>
    );
  }


  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <a
            href={deploymentUrl!} // `deploymentUrl` is checked to be non-null here
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textSecondary hover:text-[#F38020] z-50" // Cloudflare Orange
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div className={`i-ph:link w-4 h-4 hover:text-blue-400 ${isLoading ? 'animate-pulse' : ''}`} />
          </a>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="px-3 py-2 rounded bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary text-xs z-[9999]" // Higher z-index for visibility
            sideOffset={5}
          >
            {deploymentUrl}
            <Tooltip.Arrow className="fill-bolt-elements-background-depth-3" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
