import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { loadDetailedWordsForLanguagePair } from '../data/wordLists';

const { width } = Dimensions.get('window');

interface DetailedDataLoaderProps {
  visible: boolean;
  onComplete: () => void;
  languagePair: string;
}

export const DetailedDataLoader: React.FC<DetailedDataLoaderProps> = ({
  visible,
  onComplete,
  languagePair,
}) => {
  const { colors } = useTheme();
  const { translations } = useLanguage();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'loading' | 'completed' | 'error'>('loading');
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    if (visible) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, languagePair]);

  const loadData = async () => {
    try {
      setStatus('loading');
      setProgress(0);
      setStatusText(translations.detailedDataLoader.loading);

      const success = await loadDetailedWordsForLanguagePair(
        languagePair,
        (progressValue) => {
          setProgress(progressValue);
          setStatusText(
            `${translations.detailedDataLoader.loading} (${Math.floor(progressValue)}%)`
          );
        }
      );

      if (!success) {
        throw new Error('Detaylı veri yüklemesi başarısız oldu');
      }

      setProgress(100);
      setStatus('completed');
      setStatusText(translations.detailedDataLoader.completed);
      setTimeout(onComplete, 1500);
    } catch (error) {
      console.error('Detaylı veri indirme hatası:', error);
      setStatus('error');
      setStatusText(translations.detailedDataLoader.error);
      setTimeout(onComplete, 2000);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <StatusBar backgroundColor="rgba(0, 0, 0, 0.8)" />
      <View style={styles.container}>
        <View style={[styles.content, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {status === 'loading'
              ? translations.detailedDataLoader.loading
              : status === 'completed'
              ? translations.detailedDataLoader.completed
              : translations.detailedDataLoader.error}
          </Text>

          {status === 'loading' && (
            <>
              <ActivityIndicator
                size="large"
                color={colors.primary}
                style={styles.loader}
              />

              <View style={styles.progressContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      backgroundColor: colors.primary,
                      width: `${progress}%`,
                    },
                  ]}
                />
              </View>

              <Text style={[styles.statusText, { color: colors.text.secondary }]}>
                {statusText}
              </Text>

              <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                {translations.detailedDataLoader.pleaseWait}
              </Text>
            </>
          )}

          {status === 'completed' && (
            <Text style={[styles.statusText, { color: colors.text.secondary }]}>
              {translations.detailedDataLoader.completed}
            </Text>
          )}

          {status === 'error' && (
            <Text style={[styles.statusText, { color: colors.error }]}>
              {translations.detailedDataLoader.error}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 9999,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  content: {
    width: width * 0.85,
    minHeight: 250,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  loader: {
    marginVertical: 24,
  },
  progressContainer: {
    width: '100%',
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  statusText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 12,
  },
});
