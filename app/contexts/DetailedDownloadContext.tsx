import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { loadDetailedWordsForLanguagePair } from '../data/wordLists';

interface DetailedDownloadContextType {
  isDownloading: boolean;
  progress: number;
  status: 'idle' | 'loading' | 'completed' | 'error';
  startDownload: (languagePair: string, onComplete?: () => void) => void;
  dismiss: () => void;
}

const DetailedDownloadContext = createContext<DetailedDownloadContextType | undefined>(undefined);

export const DetailedDownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'completed' | 'error'>('idle');
  const onCompleteRef = useRef<(() => void) | null>(null);

  const dismiss = useCallback(() => {
    setIsDownloading(false);
    setStatus('idle');
    setProgress(0);
    if (onCompleteRef.current) {
      onCompleteRef.current();
      onCompleteRef.current = null;
    }
  }, []);

  const startDownload = useCallback((languagePair: string, onComplete?: () => void) => {
    // Zaten indirme devam ediyorsa tekrar başlatma
    if (status === 'loading') return;

    onCompleteRef.current = onComplete || null;
    setIsDownloading(true);
    setStatus('loading');
    setProgress(0);

    loadDetailedWordsForLanguagePair(languagePair, (progressValue) => {
      setProgress(progressValue);
    })
      .then((success) => {
        if (!success) throw new Error('Detaylı veri yüklemesi başarısız oldu');
        setProgress(100);
        setStatus('completed');
        // Tamamlandıktan 2.5s sonra otomatik kapat
        setTimeout(() => {
          dismiss();
        }, 2500);
      })
      .catch((error) => {
        console.error('Detaylı veri indirme hatası:', error);
        setStatus('error');
        setTimeout(() => {
          dismiss();
        }, 3000);
      });
  }, [status, dismiss]);

  return (
    <DetailedDownloadContext.Provider
      value={{ isDownloading, progress, status, startDownload, dismiss }}
    >
      {children}
    </DetailedDownloadContext.Provider>
  );
};

export const useDetailedDownload = () => {
  const context = useContext(DetailedDownloadContext);
  if (context === undefined) {
    throw new Error('useDetailedDownload must be used within a DetailedDownloadProvider');
  }
  return context;
};
