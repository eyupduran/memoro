import React, { useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, Modal, Alert, BackHandler } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import WebView from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

type Props = NativeStackScreenProps<RootStackParamList, 'DetailedDictionary'>;

export const DetailedDictionaryScreen: React.FC<Props> = ({ route }) => {
  const { colors } = useTheme();
  const { translations } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const webViewRef = useRef<WebView>(null);
  const navigation = useNavigation();
  
  // Route'dan kelimeyi al
  const { wordName } = route.params;
  const selectedUrl = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(wordName)}`;

  // Geri tuşu için uyarı
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        // Doğrudan çıkış yap, uyarı gösterme
        navigation.goBack();
        return true;
      };

      // Android geri tuşu için event listener ekle
      BackHandler.addEventListener('hardwareBackPress', onBackPress);

      // Cleanup function
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [navigation])
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <WebView
        ref={webViewRef}
        source={{ uri: selectedUrl }}
        style={styles.webview}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
      />
      
      {isLoading && (
        <View style={[styles.loading, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
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
}); 