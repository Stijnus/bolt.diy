import { AnimatePresence, motion } from 'framer-motion';
import type { ActionAlert } from '~/types/actions';
import { classNames } from '~/utils/classNames';

interface Props {
  alert: ActionAlert;
  clearAlert: () => void;
  postMessage: (message: string) => void;
}

export default function ChatAlert({ alert, clearAlert, postMessage }: Props) {
  const { description, content, source, notificationType = 'interactive', type } = alert;

  // Use the actual alert title if it's a notification
  const isNotification = notificationType === 'notification';

  const isPreview = source === 'preview';
  const title = isNotification ? alert.title : isPreview ? 'Preview Error' : 'Terminal Error';

  // Different message for notifications vs. interactive alerts
  const message = isNotification
    ? alert.content
    : isPreview
      ? 'We encountered an error while running the preview. Would you like Bolt to analyze and help resolve this issue?'
      : 'We encountered an error while running terminal commands. Would you like Bolt to analyze and help resolve this issue?';

  // Different icon based on alert type
  const iconClass = isNotification
    ? type === 'info'
      ? 'i-ph:info-duotone text-bolt-elements-button-primary-text'
      : 'i-ph:warning-duotone text-bolt-elements-button-danger-text'
    : 'i-ph:warning-duotone text-bolt-elements-button-danger-text';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={`rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4 mb-2`}
      >
        <div className="flex items-start">
          {/* Icon */}
          <motion.div
            className="flex-shrink-0"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className={iconClass}></div>
          </motion.div>
          {/* Content */}
          <div className="ml-3 flex-1">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className={`text-sm font-medium text-bolt-elements-textPrimary`}
            >
              {title}
            </motion.h3>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={`mt-2 text-sm text-bolt-elements-textSecondary`}
            >
              <p>{message}</p>
              {!isNotification && description && (
                <div className="text-xs text-bolt-elements-textSecondary p-2 bg-bolt-elements-background-depth-3 rounded mt-4 mb-4">
                  Error: {description}
                </div>
              )}
            </motion.div>

            {/* Actions - only show for interactive alerts */}
            {!isNotification && (
              <motion.div
                className="mt-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className={classNames(' flex gap-2')}>
                  <button
                    onClick={() =>
                      postMessage(
                        `*Fix this ${isPreview ? 'preview' : 'terminal'} error* \n\`\`\`${isPreview ? 'js' : 'sh'}\n${content}\n\`\`\`\n`,
                      )
                    }
                    className={classNames(
                      `px-2 py-1.5 rounded-md text-sm font-medium`,
                      'bg-bolt-elements-button-primary-background',
                      'hover:bg-bolt-elements-button-primary-backgroundHover',
                      'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bolt-elements-button-danger-background',
                      'text-bolt-elements-button-primary-text',
                      'flex items-center gap-1.5',
                    )}
                  >
                    <div className="i-ph:chat-circle-duotone"></div>
                    Ask Bolt
                  </button>
                  <button
                    onClick={clearAlert}
                    className={classNames(
                      `px-2 py-1.5 rounded-md text-sm font-medium`,
                      'bg-bolt-elements-button-secondary-background',
                      'hover:bg-bolt-elements-button-secondary-backgroundHover',
                      'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bolt-elements-button-secondary-background',
                      'text-bolt-elements-button-secondary-text',
                    )}
                  >
                    Dismiss
                  </button>
                </div>
              </motion.div>
            )}

            {/* Just a dismiss button for notifications */}
            {isNotification && (
              <motion.div
                className="mt-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex justify-end">
                  <button
                    onClick={clearAlert}
                    className={classNames(
                      `px-2 py-1 rounded-md text-xs font-medium`,
                      'bg-bolt-elements-button-secondary-background',
                      'hover:bg-bolt-elements-button-secondary-backgroundHover',
                      'focus:outline-none',
                      'text-bolt-elements-button-secondary-text',
                    )}
                  >
                    Dismiss
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
