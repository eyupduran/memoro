import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { cloudSync, SyncState } from '../services/cloudSync';
import { MaterialIcons } from '@expo/vector-icons';

/**
 * Global banner — App.tsx seviyesinde render edilir.
 * cloudSync state'ini dinleyerek login sonrası veri aktarımını gösterir.
 */
export const SyncBanner: React.FC = () => {
  const { colors } = useTheme();
  const { translations } = useLanguage();
  const [syncState, setSyncState] = useState<SyncState>(cloudSync.getState());
  const slideAnim = useRef(new Animated.Value(100)).current;
  const wasVisible = useRef(false);

  useEffect(() => {
    return cloudSync.subscribe((state) => {
      setSyncState(state);
    });
  }, []);

  const isSyncing = syncState.status === 'syncing';
  const isError = syncState.status === 'error';
  const shouldShow = isSyncing || isError;

  useEffect(() => {
    if (shouldShow && !wasVisible.current) {
      wasVisible.current = true;
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else if (!shouldShow && wasVisible.current) {
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        wasVisible.current = false;
      });
    }
  }, [shouldShow, slideAnim]);

  if (!shouldShow && !wasVisible.current) return null;

  const t = translations.auth;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: isError ? '#C62828' : colors.primary,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        {isSyncing ? (
          <ActivityIndicator size="small" color={colors.text.onPrimary} />
        ) : (
          <MaterialIcons name="error" size={20} color="#F44336" />
        )}
        <Text style={[styles.statusText, { color: colors.text.onPrimary }]} numberOfLines={1}>
          {isSyncing ? t.bootstrapTitle : syncState.error || t.bootstrapTitle}
        </Text>
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
    zIndex: 9998,
    paddingBottom: 4,
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
