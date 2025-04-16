import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Button } from '~/components/ui/Button';
import { generateQRCode } from '~/utils/qr-generator';

export interface ExpoQrPopupProps {
  qrCodeUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ExpoQrPopup({ qrCodeUrl, isOpen, onClose }: ExpoQrPopupProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWebUrl, setIsWebUrl] = useState(false);

  // Detect if this is a web URL (http/https) or mobile URL (exp)
  useEffect(() => {
    setIsWebUrl(qrCodeUrl.startsWith('http://') || qrCodeUrl.startsWith('https://'));
  }, [qrCodeUrl]);

  // Generate QR code when URL changes
  useEffect(() => {
    if (qrCodeUrl) {
      console.log('QRCodePopup: Generating QR code for URL:', qrCodeUrl);
      setIsLoading(true);
      generateQRCode(qrCodeUrl)
        .then((dataUrl) => {
          setQrCodeDataUrl(dataUrl);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error('Failed to generate QR code:', error);
          setIsLoading(false);
        });
    }
  }, [qrCodeUrl]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(qrCodeUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL', err);
    }
  };

  // Open web URL in new tab
  const handleOpenWebUrl = () => {
    if (isWebUrl) {
      window.open(qrCodeUrl, '_blank');
    }
  };

  // Create a formatted version of the URL for better clarity
  const formattedUrl = isWebUrl 
    ? qrCodeUrl 
    : qrCodeUrl ? `exp://${qrCodeUrl.replace(/^exp:\/\//, '')}` : '';

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog showCloseButton={true} onClose={onClose}>
        <div className="p-6 bg-white dark:bg-gray-950 relative z-10">
          <DialogTitle>
            <div className="i-ph:qr-code-duotone mr-2 text-bolt-elements-textPrimary" />
            {isWebUrl ? 'Web Preview Available' : 'Scan QR Code'}
          </DialogTitle>
          <DialogDescription className="mb-4">
            {isWebUrl 
              ? 'Your Expo app is running. Click to open in browser or scan QR code to view on mobile.'
              : 'Install Expo Go on your device and scan this QR code to view your project'}
          </DialogDescription>

          <div className="flex flex-col items-center justify-center mb-4">
            {qrCodeUrl ? (
              <div
                className="bg-white p-4 rounded-lg mb-4 cursor-pointer"
                onClick={isWebUrl ? handleOpenWebUrl : handleCopyUrl}
                title={isWebUrl ? "Click to open in browser" : "Click to copy URL"}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center w-[200px] h-[200px]">
                    <div className="i-ph:spinner-gap-bold animate-spin w-8 h-8 text-bolt-elements-loader-progress" />
                  </div>
                ) : (
                  <img src={qrCodeDataUrl || ''} alt="QR Code" width={200} height={200} className="rounded-sm" />
                )}
              </div>
            ) : (
              <div className="bg-white p-4 rounded-lg flex items-center justify-center w-[200px] h-[200px] mb-4">
                <div className="i-ph:spinner-gap-bold animate-spin w-8 h-8 text-bolt-elements-loader-progress" />
              </div>
            )}

            <div className="text-sm text-bolt-elements-textSecondary mb-2">
              URL: <span className="font-mono select-all">{formattedUrl}</span>
            </div>

            <div className="text-xs text-bolt-elements-textTertiary bg-gray-100 dark:bg-gray-900 p-2 rounded w-full font-mono overflow-x-auto">
              <div>URL: {qrCodeUrl}</div>
              {!isWebUrl && <div>Formatted: {formattedUrl}</div>}
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            {isWebUrl ? (
              <Button variant="outline" onClick={handleOpenWebUrl} className="flex items-center gap-1">
                <div className="i-ph:browser-bold w-4 h-4" />
                Open in Browser
              </Button>
            ) : (
              <Button variant="outline" onClick={handleCopyUrl} className="flex items-center gap-1">
                {isCopied ? (
                  <>
                    <div className="i-ph:check-bold w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <div className="i-ph:copy-simple-bold w-4 h-4" />
                    Copy URL
                  </>
                )}
              </Button>
            )}
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </Dialog>
    </RadixDialog.Root>
  );
}
