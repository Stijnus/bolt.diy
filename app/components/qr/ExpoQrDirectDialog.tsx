import React, { useState, useEffect } from 'react';
import { ExpoQrPopup } from './ExpoQrPopup';
import { qrDetector } from '~/utils/qr-detector';

export interface ExpoQrDirectDialogProps {
  className?: string;
}

export function ExpoQrDirectDialog(_: ExpoQrDirectDialogProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);

  useEffect(() => {
    console.log('ExpoQrDirectDialog mounted, setting up QR code listener');

    // Set session started flag to track new session
    setSessionStarted(true);

    // Listen for QR code URLs and open dialog only for newly detected codes
    const unsubscribe = qrDetector.addListener((url: string, isNewDetection: boolean) => {
      console.log('QR code listener received URL:', url, 'isNewDetection:', isNewDetection);

      // Only show popup for newly detected QR codes during this session
      if (isNewDetection && sessionStarted) {
        console.log('Showing QR code popup for URL:', url);
        setQrCodeUrl(url);
        setShowPopup(true);
      }
    });

    return () => {
      console.log('ExpoQrDirectDialog unmounting, cleaning up listener');
      unsubscribe();
    };
  }, [sessionStarted]);

  const handleClose = () => {
    console.log('QR code popup closed');
    setShowPopup(false);
  };

  return <>{qrCodeUrl && <ExpoQrPopup qrCodeUrl={qrCodeUrl} isOpen={showPopup} onClose={handleClose} />}</>;
}
