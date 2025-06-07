import React, { useEffect, useState, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { StyleSheet, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';

const GamesScreen = () => {
  const { colors } = useTheme();
  const [currentUrl, setCurrentUrl] = useState('https://www.gamestolearnenglish.com/');
  const [canGoBack, setCanGoBack] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // Ana sayfada tüm içeriği, oyun sayfalarında sadece oyun alanını göstermek için JavaScript
  const injectedJavaScript = `
    (function() {
      let isFiltering = false;
      let isFiltered = false;

      function filterContent() {
        if (isFiltering || isFiltered) return;
        
        const currentPath = window.location.pathname;
        console.log('Current path:', currentPath);
        
        if (currentPath !== '/' && currentPath !== '') {
          isFiltering = true;
          
          // Canvas elementini bul (oyun alanı genellikle canvas içinde)
          const canvas = document.querySelector('canvas');
          console.log('Canvas found:', canvas);
          
          if (canvas && canvas.parentElement) {
            const gameContainer = canvas.parentElement;
            console.log('Game container found:', gameContainer);
            
            try {
              // Önemli elementleri sakla
              const scripts = Array.from(document.getElementsByTagName('script'));
              const styles = Array.from(document.getElementsByTagName('style'));
              const links = Array.from(document.getElementsByTagName('link'));
              
              // Yeni wrapper oluştur
              const wrapper = document.createElement('div');
              wrapper.id = 'game-wrapper';
              wrapper.style.position = 'fixed';
              wrapper.style.top = '0';
              wrapper.style.left = '0';
              wrapper.style.width = '100%';
              wrapper.style.height = '100%';
              wrapper.style.backgroundColor = '${colors.background}';
              wrapper.style.display = 'flex';
              wrapper.style.justifyContent = 'center';
              wrapper.style.alignItems = 'center';
              
              // Head elementini koru
              const head = document.head;
              
              // Body'yi temizle ve wrapper'ı ekle
              const body = document.body;
              const oldBody = body.cloneNode(true);
              body.innerHTML = '';
              body.style.margin = '0';
              body.style.padding = '0';
              body.style.backgroundColor = '${colors.background}';
              body.style.overflow = 'hidden';
              
              // Oyun container'ını ayarla
              gameContainer.style.width = '100%';
              gameContainer.style.height = '100%';
              gameContainer.style.display = 'flex';
              gameContainer.style.justifyContent = 'center';
              gameContainer.style.alignItems = 'center';
              
              // Canvas'ı responsive yap
              canvas.style.maxWidth = '100%';
              canvas.style.maxHeight = '100%';
              canvas.style.objectFit = 'contain';
              
              // Elementleri sırayla ekle
              wrapper.appendChild(gameContainer);
              body.appendChild(wrapper);
              
              // Scriptleri geri ekle
              scripts.forEach(script => {
                if (!script.hasAttribute('filtered')) {
                  const newScript = document.createElement('script');
                  if (script.src) {
                    newScript.src = script.src;
                    newScript.async = script.async;
                    newScript.defer = script.defer;
                  } else if (script.textContent) {
                    newScript.textContent = script.textContent;
                  }
                  newScript.setAttribute('filtered', 'true');
                  body.appendChild(newScript);
                }
              });
              
              isFiltered = true;
              console.log('Filtering completed successfully');
            } catch (error) {
              console.error('Error during filtering:', error);
              // Hata durumunda orijinal içeriği geri yükle
              isFiltered = false;
            }
          }
          
          isFiltering = false;
        }
      }
      
      // Sayfa yüklendiğinde bir kere çalıştır
      if (document.readyState === 'complete') {
        setTimeout(filterContent, 1000);
      } else {
        window.addEventListener('load', () => setTimeout(filterContent, 1000));
      }
      
      // DOM değişikliklerini izle ama sadece canvas eklendiğinde
      const observer = new MutationObserver((mutations) => {
        if (!isFiltered && document.querySelector('canvas')) {
          setTimeout(filterContent, 1000);
        }
      });
      
      observer.observe(document.body, { 
        childList: true, 
        subtree: true 
      });
      
      true;
    })();
  `;

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
        injectedJavaScript={injectedJavaScript}
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