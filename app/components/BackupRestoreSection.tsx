import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { backupService } from '../services/backup';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BackupRestoreSectionProps {
  currentLanguagePair: string;
  onRestoreComplete?: () => void;
  onImportComplete?: (result: { success: boolean; languagePair?: string }) => void;
}

export const BackupRestoreSection: React.FC<BackupRestoreSectionProps> = ({ 
  currentLanguagePair,
  onRestoreComplete,
  onImportComplete
}) => {
  const { colors, setTheme } = useTheme();
  const { translations, setNativeLanguage } = useLanguage();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Ayarları yeniden yükle
  const reloadSettings = async () => {
    try {
      // Tema ayarını yeniden yükle
      const themeSetting = await AsyncStorage.getItem('theme');
      if (themeSetting) {
        // Tema değişikliğini uygula
        setTimeout(() => {
          setTheme(themeSetting as any);
        }, 100);
      }
      
      // Dil ayarını yeniden yükle
      const languageSetting = await AsyncStorage.getItem('selectedLanguage');
      if (languageSetting) {
        setTimeout(() => {
          setNativeLanguage(languageSetting as any);
        }, 200);
      }
      
      // Ek callback varsa çağır
      if (onRestoreComplete) {
        setTimeout(() => {
          onRestoreComplete();
        }, 300);
      }
    } catch (error) {
      console.error('Ayarlar yeniden yüklenirken hata:', error);
    }
  };

  // Verileri dışa aktar
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await backupService.backupData(currentLanguagePair);
      if (result) {
        Alert.alert(
          translations.alerts.success,
          translations.settings.backup.exportSuccess
        );
      } else {
        Alert.alert(
          translations.alerts.error,
          translations.settings.backup.exportError
        );
      }
    } catch (error) {
      console.error('Dışa aktarma hatası:', error);
      Alert.alert(
        translations.alerts.error,
        translations.settings.backup.exportError
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Verileri içe aktar
  const handleImport = async () => {
    // Önce kullanıcıya uyarı göster
    Alert.alert(
      translations.settings.backup.title,
      translations.settings.backup.importWarning,
      [
        {
          text: translations.settings.backup.importCancel,
          style: 'cancel'
        },
        {
          text: translations.settings.backup.importConfirm,
          onPress: async () => {
            setIsImporting(true);
            try {
              const result = await backupService.restoreData(reloadSettings);
              if (onImportComplete) {
                onImportComplete(result);
              } else {
                if (result.success) {
                  Alert.alert(
                    translations.alerts.success,
                    translations.settings.backup.importSuccess
                  );
                } else {
                  Alert.alert(
                    translations.alerts.error,
                    translations.settings.backup.importError
                  );
                }
              }
            } catch (error) {
              console.error('İçe aktarma hatası:', error);
              Alert.alert(
                translations.alerts.error,
                translations.settings.backup.importError
              );
            } finally {
              setIsImporting(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text.primary }]}>
        {translations.settings.backup.title}
      </Text>
      
      <Text style={[styles.description, { color: colors.text.secondary }]}>
        {translations.settings.backup.description}
      </Text>
      
      <View style={[styles.card, { backgroundColor: colors.card.background }]}>
        <View style={styles.infoContainer}>
          <MaterialIcons 
            name="info-outline" 
            size={20} 
            color={colors.text.secondary} 
            style={styles.infoIcon}
          />
          <Text style={[styles.infoText, { color: colors.text.secondary }]}>
            {translations.settings.backup.exportInfo}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <ActivityIndicator color={colors.text.onPrimary} />
          ) : (
            <>
              <MaterialIcons name="cloud-download" size={20} color={colors.text.onPrimary} />
              <Text style={[styles.buttonText, { color: colors.text.onPrimary }]}>
                {translations.settings.backup.export}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      
      <View style={[styles.card, { backgroundColor: colors.card.background, marginTop: 16 }]}>
        <View style={styles.infoContainer}>
          <MaterialIcons 
            name="info-outline" 
            size={20} 
            color={colors.text.secondary} 
            style={styles.infoIcon}
          />
          <Text style={[styles.infoText, { color: colors.text.secondary }]}>
            {translations.settings.backup.importInfo}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleImport}
          disabled={isImporting}
        >
          {isImporting ? (
            <ActivityIndicator color={colors.text.onPrimary} />
          ) : (
            <>
              <MaterialIcons name="cloud-upload" size={20} color={colors.text.onPrimary} />
              <Text style={[styles.buttonText, { color: colors.text.onPrimary }]}>
                {translations.settings.backup.import}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  card: {
    padding: 16,
    borderRadius: 12,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 