import * as RadixDialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { classNames } from '~/utils/classNames';
import { DialogTitle, dialogVariants, dialogBackdropVariants } from '~/components/ui/Dialog';
import { IconButton } from '~/components/ui/IconButton';
import styles from './Settings.module.scss';
import ProvidersTab from './providers/ProvidersTab';
import { useSettings } from '~/lib/hooks/useSettings';
import FeaturesTab from './features/FeaturesTab';
import DebugTab from './debug/DebugTab';
import EventLogsTab from '~/components/settings/event-logs/EventLogsTab';
import ConnectionsTab from './connections/ConnectionsTab';
import DataTab from './data/DataTab';
import UpdatesTab from './updates/UpdatesTab';

interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

type TabType = 'data' | 'providers' | 'features' | 'debug' | 'event-logs' | 'connection' | 'updates';

export const SettingsWindow = ({ open, onClose }: SettingsProps) => {
  const { debug, eventLogs, updatesEnabled } = useSettings();
  const [activeTab, setActiveTab] = useState<TabType>('data');

  // Memoize tabs to prevent unnecessary re-renders
  const tabs = useMemo(() => {
    const baseTabs = [
      { id: 'data' as TabType, label: 'Data', icon: 'i-ph:database', component: <DataTab /> },
      { id: 'providers' as TabType, label: 'Providers', icon: 'i-ph:key', component: <ProvidersTab /> },
      { id: 'connection' as TabType, label: 'Connection', icon: 'i-ph:link', component: <ConnectionsTab /> },
      { id: 'features' as TabType, label: 'Features', icon: 'i-ph:star', component: <FeaturesTab /> },
    ];

    if (updatesEnabled) {
      baseTabs.push({
        id: 'updates',
        label: 'Updates',
        icon: 'i-ph:arrow-clockwise',
        component: <UpdatesTab />,
      });
    }

    if (debug) {
      baseTabs.push({
        id: 'debug',
        label: 'Debug Tab',
        icon: 'i-ph:bug',
        component: <DebugTab />,
      });
    }

    if (eventLogs) {
      baseTabs.push({
        id: 'event-logs',
        label: 'Event Logs',
        icon: 'i-ph:list-bullets',
        component: <EventLogsTab />,
      });
    }

    return baseTabs;
  }, [debug, eventLogs, updatesEnabled]);

  // If the current tab is disabled, switch to data tab
  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab('data');
    }
  }, [tabs, activeTab]);

  return (
    <RadixDialog.Root open={open}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay asChild onClick={onClose}>
          <motion.div
            className="bg-black/50 fixed inset-0 z-max backdrop-blur-sm"
            initial="closed"
            animate="open"
            exit="closed"
            variants={dialogBackdropVariants}
          />
        </RadixDialog.Overlay>
        <RadixDialog.Content aria-describedby={undefined} asChild>
          <motion.div
            className="fixed top-[50%] left-[50%] z-max h-[85vh] w-[90vw] max-w-[900px] translate-x-[-50%] translate-y-[-50%] border border-bolt-elements-borderColor rounded-lg shadow-lg focus:outline-none overflow-hidden"
            initial="closed"
            animate="open"
            exit="closed"
            variants={dialogVariants}
          >
            <div className="flex h-full">
              <div
                className={classNames(
                  'w-48 border-r border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-4 flex flex-col justify-between',
                  styles['settings-tabs'],
                )}
              >
                <DialogTitle className="flex-shrink-0 text-lg font-semibold text-bolt-elements-textPrimary mb-2">
                  Settings
                </DialogTitle>
                <div className="flex flex-col">
                  <button
                    onClick={() => setActiveTab('data')}
                    className={classNames(activeTab === 'data' ? styles.active : '')}
                  >
                    <div className="i-ph:database" />
                    Data
                  </button>
                  <button
                    onClick={() => setActiveTab('providers')}
                    className={classNames(activeTab === 'providers' ? styles.active : '')}
                  >
                    <div className="i-ph:key" />
                    Providers
                  </button>
                  <button
                    onClick={() => setActiveTab('connection')}
                    className={classNames(activeTab === 'connection' ? styles.active : '')}
                  >
                    <div className="i-ph:link" />
                    Connection
                  </button>
                  <button
                    onClick={() => setActiveTab('features')}
                    className={classNames(activeTab === 'features' ? styles.active : '')}
                  >
                    <div className="i-ph:star" />
                    Features
                  </button>

                  {updatesEnabled && (
                    <button
                      onClick={() => setActiveTab('updates')}
                      className={classNames(activeTab === 'updates' ? styles.active : '')}
                    >
                      <div className="i-ph:arrow-clockwise" />
                      Updates
                    </button>
                  )}
                  {debug && (
                    <button
                      onClick={() => setActiveTab('debug')}
                      className={classNames(activeTab === 'debug' ? styles.active : '')}
                    >
                      <div className="i-ph:bug" />
                      Debug Tab
                    </button>
                  )}
                  {eventLogs && (
                    <button
                      onClick={() => setActiveTab('event-logs')}
                      className={classNames(activeTab === 'event-logs' ? styles.active : '')}
                    >
                      <div className="i-ph:list-bullets" />
                      Event Logs
                    </button>
                  )}
                </div>
                <div className="mt-auto flex flex-col gap-2">
                  <a
                    href="https://github.com/stackblitz-labs/bolt.diy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classNames(styles['settings-button'], 'flex items-center gap-2')}
                  >
                    <div className="i-ph:github-logo" />
                    GitHub
                  </a>
                  <a
                    href="https://stackblitz-labs.github.io/bolt.diy/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classNames(styles['settings-button'], 'flex items-center gap-2')}
                  >
                    <div className="i-ph:book" />
                    Docs
                  </a>
                </div>
              </div>

              <div className="flex-1 flex flex-col p-8 pt-10 bg-bolt-elements-background-depth-2">
                <div className="flex-1 overflow-y-auto">{tabs.find((tab) => tab.id === activeTab)?.component}</div>
              </div>
            </div>
            <RadixDialog.Close asChild onClick={onClose}>
              <IconButton icon="i-ph:x" className="absolute top-[10px] right-[10px]" />
            </RadixDialog.Close>
          </motion.div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};
