import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { DeployButton } from '~/components/deploy/DeployButton';
import { AssociateChatDialog } from '~/components/projects/AssociateChatDialog';
import { description, useChatHistory } from '~/lib/persistence';
import { toast } from 'react-toastify';

interface HeaderActionButtonsProps {
  chatStarted: boolean;
}

export function HeaderActionButtons({ chatStarted: _chatStarted }: HeaderActionButtonsProps) {
  const [activePreviewIndex] = useState(0);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const chatDescription = useStore(description);
  const { updateChatMetadata } = useChatHistory();

  const shouldShowButtons = activePreview;

  const handleAssociateWithProject = async (projectId: string, featureId: string) => {
    try {
      await updateChatMetadata({
        gitUrl: '', // Empty since we're associating existing chat
        projectId,
        featureId,
      });
      toast.success('Chat associated with project feature');
    } catch (error) {
      console.error('Error associating chat with project:', error);
      toast.error('Failed to associate chat with project');
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Project Association Button */}
        <button
          onClick={() => setShowProjectDialog(true)}
          className="flex items-center justify-center [&:is(:disabled,.disabled)]:cursor-not-allowed [&:is(:disabled,.disabled)]:opacity-60 px-3 py-1.5 text-xs bg-purple-600 text-white hover:bg-purple-700 rounded-md transition-colors flex gap-1.5"
          title="Associate with Project"
        >
          <div className="i-ph:folder-plus" />
          <span>Add to Project</span>
        </button>

        {/* Deploy Button */}
        {shouldShowButtons && <DeployButton />}

        {/* Debug Tools */}
        {shouldShowButtons && (
          <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden text-sm">
            <button
              onClick={() =>
                window.open('https://github.com/stackblitz-labs/bolt.diy/issues/new?template=bug_report.yml', '_blank')
              }
              className="rounded-l-md items-center justify-center [&:is(:disabled,.disabled)]:cursor-not-allowed [&:is(:disabled,.disabled)]:opacity-60 px-3 py-1.5 text-xs bg-accent-500 text-white hover:text-bolt-elements-item-contentAccent [&:not(:disabled,.disabled)]:hover:bg-bolt-elements-button-primary-backgroundHover outline-accent-500 flex gap-1.5"
              title="Report Bug"
            >
              <div className="i-ph:bug" />
              <span>Report Bug</span>
            </button>
            <div className="w-px bg-bolt-elements-borderColor" />
            <button
              onClick={async () => {
                try {
                  const { downloadDebugLog } = await import('~/utils/debugLogger');
                  await downloadDebugLog();
                } catch (error) {
                  console.error('Failed to download debug log:', error);
                }
              }}
              className="rounded-r-md items-center justify-center [&:is(:disabled,.disabled)]:cursor-not-allowed [&:is(:disabled,.disabled)]:opacity-60 px-3 py-1.5 text-xs bg-accent-500 text-white hover:text-bolt-elements-item-contentAccent [&:not(:disabled,.disabled)]:hover:bg-bolt-elements-button-primary-backgroundHover outline-accent-500 flex gap-1.5"
              title="Download Debug Log"
            >
              <div className="i-ph:download" />
              <span>Debug Log</span>
            </button>
          </div>
        )}
      </div>

      {/* Project Association Dialog */}
      <AssociateChatDialog
        isOpen={showProjectDialog}
        onClose={() => setShowProjectDialog(false)}
        onAssociate={handleAssociateWithProject}
        chatDescription={chatDescription}
      />
    </>
  );
}
