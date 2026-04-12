import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useDetailedDownload } from '../contexts/DetailedDownloadContext';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Global banner — App.tsx seviyesinde bir kez render edilir.
 * İndirme durumunu DetailedDownloadContext'ten okur.
 */
export const DetailedDataLoaderBanner: React.FC = () => {
  const { colors } = useTheme();
  const { translations } = useLanguage();
  const { isDownloading, progress, status, dismiss } = useDetailedDownload();
  const slideAnim = useRef(new Animated.Value(100)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const isVisible = useRef(false);

  useEffect(() => {
    if (isDownloading && !isVisible.current) {
      isVisible.current = true;
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else if (!isDownloading && isVisible.current) {
      isVisible.current = false;
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isDownloading, slideAnim]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  if (!isDownloading) return null;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const iconName =
    status === 'completed' ? 'check-circle' : status === 'error' ? 'error' : 'cloud-download';
  const iconColor =
    status === 'completed' ? '#4CAF50' : status === 'error' ? '#F44336' : colors.text.onPrimary;

  const statusText =
    status === 'loading'
      ? `${translations.detailedDataLoader.loading} (${Math.floor(progress)}%)`
      : status === 'completed'
      ? translations.detailedDataLoader.completed
      : translations.detailedDataLoader.error;

  const bgColor =
    status === 'completed' ? '#2E7D32' : status === 'error' ? '#C62828' : colors.primary;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: bgColor,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {status === 'loading' && (
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: progressWidth, backgroundColor: 'rgba(255,255,255,0.3)' },
            ]}
          />
        </View>
      )}

      <View style={styles.content}>
        <MaterialIcons name={iconName} size={20} color={iconColor} />
        <Text style={[styles.statusText, { color: colors.text.onPrimary }]} numberOfLines={1}>
          {statusText}
        </Text>
        {status !== 'loading' && (
          <TouchableOpacity
            onPress={dismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="close" size={18} color={colors.text.onPrimary} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingBottom: 4,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  progressFill: {
    height: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
});
