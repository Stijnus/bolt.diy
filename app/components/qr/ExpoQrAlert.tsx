import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';
import { ExpoQrPopup } from './ExpoQrPopup';
import { qrDetector } from '~/utils/qr-detector';

export interface ExpoQrAlertProps {
  className?: string;
}

export function ExpoQrAlert({ className }: ExpoQrAlertProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    // Listen for QR code URLs
    const unsubscribe = qrDetector.addListener((url, isNewDetection) => {
      setQrCodeUrl(url);

      // Only show alert for newly detected QR codes, not for URLs loaded from localStorage
      if (isNewDetection) {
        setShowAlert(true);
      }
    });

    return unsubscribe;
  }, []);

  const handleDismiss = () => {
    setShowAlert(false);
  };

  const handleOpenQRCode = () => {
    setShowPopup(true);
    setShowAlert(false);
  };

  return (
    <>
      <AnimatePresence>
        {showAlert && qrCodeUrl && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={classNames(
              'rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-4 mb-2',
              className,
            )}
          >
            <div className="flex items-start">
              {/* Icon */}
              <motion.div
                className="flex-shrink-0"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="i-ph:qr-code-duotone text-xl text-bolt-elements-loader-progress"></div>
              </motion.div>
              {/* Content */}
              <div className="ml-3 flex-1">
                <motion.h3
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-sm font-medium text-bolt-elements-textPrimary"
                >
                  Expo QR Code Available
                </motion.h3>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mt-2 text-sm text-bolt-elements-textSecondary"
                >
                  <p>Your Expo app is running. Scan the QR code to preview on your mobile device.</p>
                </motion.div>

                {/* Actions */}
                <motion.div
                  className="mt-4"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="flex gap-2">
                    <Button
                      onClick={handleOpenQRCode}
                      className={classNames(
                        `px-2 py-1.5 rounded-md text-sm font-medium`,
                        'bg-bolt-elements-button-primary-background',
                        'hover:bg-bolt-elements-button-primary-backgroundHover',
                        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bolt-elements-button-primary-background',
                        'text-bolt-elements-button-primary-text',
                        'flex items-center gap-1.5',
                      )}
                    >
                      <div className="i-ph:qr-code-bold"></div>
                      View QR Code
                    </Button>
                    <Button
                      onClick={handleDismiss}
                      className={classNames(
                        `px-2 py-1.5 rounded-md text-sm font-medium`,
                        'bg-bolt-elements-button-secondary-background',
                        'hover:bg-bolt-elements-button-secondary-backgroundHover',
                        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bolt-elements-button-secondary-background',
                        'text-bolt-elements-button-secondary-text',
                      )}
                    >
                      Dismiss
                    </Button>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {qrCodeUrl && <ExpoQrPopup qrCodeUrl={qrCodeUrl} isOpen={showPopup} onClose={() => setShowPopup(false)} />}
    </>
  );
}
