import React, { useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { GrammarLevelModal } from '../components/GrammarLevelModal';
import WebView from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

type Props = NativeStackScreenProps<RootStackParamList, 'Grammar'>;

export const GrammarScreen: React.FC<Props> = () => {
  const { colors } = useTheme();
  const { translations } = useLanguage();
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [isLevelModalVisible, setIsLevelModalVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const navigation = useNavigation();

  const handleLevelSelect = (url: string) => {
    setSelectedUrl(url);
    setIsLoading(true);
    // Seviye seçildiğinde modalı kapat
    setIsLevelModalVisible(false);
  };

  const handleModalClose = () => {
    setIsLevelModalVisible(false);
    // Eğer kullanıcı henüz bir seviye seçmemişse, gramer ekranından çık
    if (!selectedUrl) {
      navigation.goBack();
    }
  };

  const handleNavigationStateChange = (navState: { canGoBack: boolean }) => {
    setCanGoBack(navState.canGoBack);
  };

  const goBack = () => {
    if (webViewRef.current) {
      webViewRef.current.goBack();
    }
  };

  const refresh = () => {
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {selectedUrl && (
        <>
          <WebView
            ref={webViewRef}
            source={{ uri: selectedUrl }}
            style={styles.webview}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onNavigationStateChange={handleNavigationStateChange}
          />
          {isLoading && (
            <View style={[styles.loading, { backgroundColor: colors.background }]}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          <View style={[styles.navigationBar, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={[
                styles.navButton,
                !canGoBack && styles.navButtonDisabled,
              ]}
              onPress={goBack}
              disabled={!canGoBack}
            >
              <MaterialIcons
                name="arrow-back"
                size={24}
                color={canGoBack ? colors.text.primary : `${colors.text.secondary}50`}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navButton}
              onPress={refresh}
            >
              <MaterialIcons
                name="refresh"
                size={24}
                color={colors.text.primary}
              />
            </TouchableOpacity>
          </View>
        </>
      )}
      <GrammarLevelModal
        visible={isLevelModalVisible}
        onClose={handleModalClose}
        onSelectLevel={handleLevelSelect}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navigationBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 56,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  navButton: {
    padding: 12,
    borderRadius: 8,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
}); 