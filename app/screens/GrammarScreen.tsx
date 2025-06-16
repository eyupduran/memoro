import React, { useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, Modal } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { GrammarLevelModal } from '../components/GrammarLevelModal';
import WebView from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import DictionaryScreen from './DictionaryScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Grammar'>;

export const GrammarScreen: React.FC<Props> = () => {
  const { colors } = useTheme();
  const { translations } = useLanguage();
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [isLevelModalVisible, setIsLevelModalVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isDictionaryModalVisible, setIsDictionaryModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

          <TouchableOpacity
            style={[
              styles.dictionaryButton, 
              { 
                backgroundColor: colors.primary,
                bottom: 80
              }
            ]}
            onPress={() => setIsDictionaryModalVisible(true)}
          >
            <MaterialIcons name="book" size={24} color={colors.text.onPrimary} />
            <Text style={[styles.dictionaryButtonText, { color: colors.text.onPrimary }]}>
              {translations.dictionary?.title || 'Sözlük'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={isDictionaryModalVisible}
        onRequestClose={() => setIsDictionaryModalVisible(false)}
      >
        <View style={[styles.modalOverlay]}>
          <View style={[styles.dictionaryModalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.dictionaryModalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity 
                onPress={() => setIsDictionaryModalVisible(false)}
                style={styles.closeDictionaryButton}
              >
                <MaterialIcons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
              <Text style={[styles.dictionaryModalTitle, { color: colors.text.primary }]}>
                {translations.dictionary?.title || 'Sözlük'}
              </Text>
              <View style={{ width: 24 }}>
                <Text> </Text>
              </View>
            </View>
            <DictionaryScreen 
              isModal={true} 
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
            />
          </View>
        </View>
      </Modal>

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
  dictionaryButton: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dictionaryButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dictionaryModalContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  dictionaryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  dictionaryModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeDictionaryButton: {
    padding: 4,
  },
}); 