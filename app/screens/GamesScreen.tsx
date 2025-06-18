import React, { useEffect, useState, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { StyleSheet, View, ActivityIndicator, TouchableOpacity, Alert, BackHandler } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

const GamesScreen = () => {
  const { colors } = useTheme();
  const { translations } = useLanguage();
  const navigation = useNavigation();
  const [currentUrl, setCurrentUrl] = useState('https://www.gamestolearnenglish.com/');
  const [canGoBack, setCanGoBack] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // Geri tuşu için uyarı
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        // Kullanıcıya oyun sayfasından çıkış uyarısı göster
        Alert.alert(
          translations.games.exitWarning.title,
          translations.games.exitWarning.message,
          [
            {
              text: translations.games.exitWarning.cancel,
              onPress: () => {},
              style: 'cancel',
            },
            {
              text: translations.games.exitWarning.confirm,
              onPress: () => {
                navigation.goBack();
              },
              style: 'destructive',
            },
          ],
          { cancelable: true }
        );
        
        // Geri tuşunun varsayılan davranışını engelle
        return true;
      };

      // Android geri tuşu için event listener ekle
      BackHandler.addEventListener('hardwareBackPress', onBackPress);

      // Cleanup function
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [translations.games.exitWarning, navigation])
  );

  const renderLoading = () => (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

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
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl }}
        style={styles.webview}
        startInLoadingState={true}
        renderLoading={renderLoading}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onNavigationStateChange={(navState) => {
          setCurrentUrl(navState.url);
          setCanGoBack(navState.canGoBack);
        }}
      />
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
  loadingContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
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

export default GamesScreen; 