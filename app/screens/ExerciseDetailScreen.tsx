import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Modal,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import type { QuestionDetail } from './ExerciseQuestionScreen';
import { dbService } from '../services/database';

type ExerciseDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'ExerciseDetail'>;
type ExerciseDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const ExerciseDetailScreen: React.FC = () => {
  const route = useRoute<ExerciseDetailScreenProps['route']>();
  const navigation = useNavigation<ExerciseDetailScreenNavigationProp>();
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  
  const { 
    exerciseId,
    score, 
    totalQuestions, 
    exerciseType,
    wordSource,
    wordListName,
    level,
    date,
    languagePair,
    details
  } = route.params;
  
  // Aktif soru indeksi için state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // Kelime listesi için state
  const [wordListModalVisible, setWordListModalVisible] = useState(false);
  const [wordLists, setWordLists] = useState<{ id: number; name: string }[]>([]);
  const [selectedWordList, setSelectedWordList] = useState<number | null>(null);
  
  // Sayfa başlığını ayarla
  useEffect(() => {
    navigation.setOptions({
      title: translations.exercise.detail.title
    });
  }, [navigation, translations]);
  
  // Kelime listelerini yükle
  useEffect(() => {
    const loadWordLists = async () => {
      try {
        const lists = await dbService.getWordLists(languagePair);
        setWordLists(lists);
      } catch (error) {
        console.error('Error loading word lists:', error);
      }
    };

    loadWordLists();
  }, [languagePair]);
  
  const formatString = (template: string, ...args: any[]) => {
    return template.replace(/{(\d+)}/g, (match, number) => {
      return typeof args[number] !== 'undefined' ? args[number] : match;
    });
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(languagePair.startsWith('en-pt') ? 'pt-BR' : 'tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  const getExerciseTypeName = (type: string) => {
    return translations.exercise.exercises[type as keyof typeof translations.exercise.exercises] || type;
  };
  
  const getWordSourceName = (source: string, wordListName?: string, level?: string | null) => {
    // Kelime listesi kaynağı
    if (source === 'wordlist' && wordListName) {
      return formatString(translations.exercise.wordListSource || 'Listemden ({0})', wordListName);
    }
    
    // Öğrenilen kelimeler kaynağı
    if (source === 'learned') {
      return translations.exercise.learnedSource || 'Öğrendiklerimden';
    }
    
    // Sözlük kaynağı
    if (source === 'dictionary') {
      // Seviye belirtildiyse
      if (level) {
        return formatString(translations.exercise.dictionaryLevelSource || '{0} Seviye', level);
      }
      // Tüm seviyeler
      return translations.exercise.dictionaryAllSource || 'Tüm Kelimeler';
    }
    
    return source;
  };
  
  const getQuestionTypeName = (type: string) => {
    switch (type) {
      case 'fillInTheBlank':
        return translations.exercise.exercises.fillInTheBlank || 'Boşluk Doldurma';
      case 'wordMatch':
        return translations.exercise.exercises.wordMatch || 'Kelime Eşleştirme';
      case 'sentenceMatch':
        return translations.exercise.exercises.sentenceMatch || 'Cümle Eşleştirme';
      case 'sentenceOrdering':
        return translations.exercise.exercises.sentenceOrdering || 'Kelime Sıralama';
      default:
        return type;
    }
  };

  // Kelime listesine ekleme
  const addToWordList = async () => {
    if (!selectedWordList || !details[currentQuestionIndex]) return;
    
    // Kelimenin farklı soru tiplerinde nerede olduğunu belirle
    let wordToAdd: string = '';
    const currentDetail = details[currentQuestionIndex];
    
    if (currentDetail.questionType === 'fillInTheBlank') {
      wordToAdd = currentDetail.correctAnswer;
    } else if (currentDetail.questionType === 'wordMatch') {
      wordToAdd = currentDetail.question;
    } else if (currentDetail.questionType === 'sentenceMatch') {
      // Cümle eşleştirmede genellikle kelime anlamı soru olarak gelir
      wordToAdd = currentDetail.question.split(' ')[0]; // İlk kelimeyi al (yaklaşık)
    }

    try {
      await dbService.addWordToList(selectedWordList, {
        id: wordToAdd,
        word: wordToAdd,
        meaning: currentDetail.correctAnswer,
        example: currentDetail.question,
        level: 'custom'
      });
      
      // Başarılı mesajı göster
      alert(translations.wordListModal?.addSuccess || 'Kelime listeye eklendi');
    } catch (error) {
      console.error('Error adding word to list:', error);
      alert(translations.wordListModal?.addError || 'Kelime eklenirken bir hata oluştu');
    } finally {
      setWordListModalVisible(false);
      setSelectedWordList(null);
    }
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < details.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const openWordListModal = () => {
    setWordListModalVisible(true);
  };

  // FillInTheBlank türü sorular için cümleyi ve boşluğu hazırlama
  const renderFillInTheBlankContent = (detail: QuestionDetail) => {
    // Doğru cevabı bul
    const correctAnswer = detail.correctAnswer;
    // Cümlede boşluk yaratmak için parçalara ayır
    const parts = detail.question.split(new RegExp(`\\b${correctAnswer}\\b`, 'i'));
    
    return (
      <View>
        <Text style={[styles.questionLabel, { color: colors.text.primary, textAlign: 'center' }]}>
          {translations.exercise.question.fillInTheBlank}
        </Text>
        
        <View style={styles.sentenceContainer}>
          {parts.length > 1 ? (
            <>
              {parts.map((part, index) => (
                <React.Fragment key={index}>
                  <Text style={[styles.sentencePart, { color: colors.text.primary }]}>
                    {part}
                  </Text>
                  {index < parts.length - 1 && (
                    <View style={[styles.blankSpace, { borderBottomColor: colors.primary }]} />
                  )}
                </React.Fragment>
              ))}
            </>
          ) : (
            <Text style={[styles.sentencePart, { color: colors.text.primary }]}>
              {detail.question}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // WordMatch türü sorular için soru ve seçenekleri hazırlama
  const renderWordMatchContent = (detail: QuestionDetail) => {
    return (
      <View>
        <Text style={[styles.questionLabel, { color: colors.text.primary, textAlign: 'center' }]}>
          {translations.exercise.question.wordMatch}
        </Text>
        
        <View style={styles.wordContainer}>
          <Text style={[styles.wordText, { color: colors.text.primary }]}>
            {detail.question}
          </Text>
        </View>
      </View>
    );
  };

  // SentenceMatch türü sorular için soru ve seçenekleri hazırlama
  const renderSentenceMatchContent = (detail: QuestionDetail) => {
    return (
      <View>
        <Text style={[styles.questionLabel, { color: colors.text.primary, textAlign: 'center' }]}>
          {translations.exercise.question.sentenceMatchQuestionPrompt}
        </Text>
        
        <View style={styles.wordContainer}>
          <Text style={[styles.wordText, { color: colors.text.primary, fontStyle: 'italic' }]}>
            {`"${detail.question}"`}
          </Text>
        </View>
      </View>
    );
  };

  // SentenceOrdering türü sorular için soru ve seçenekleri hazırlama
  const renderSentenceOrderingContent = (detail: QuestionDetail) => {
    return (
      <View>
        <Text style={[styles.questionLabel, { color: colors.text.primary, textAlign: 'center' }]}>
          {translations.exercise.question.sentenceOrderingPrompt || 'Cümleyi doğru sıralayın'}
        </Text>
        
        <View style={styles.wordContainer}>
          <Text style={[styles.wordText, { color: colors.text.primary }]}>
            {detail.question}
          </Text>
        </View>

        <View style={styles.orderingResultContainer}>
          <Text style={[styles.orderingLabel, { color: colors.text.secondary }]}>
            {translations.exercise.detail.yourAnswer || 'Sizin cevabınız:'}
          </Text>
          <Text style={[styles.orderingText, { color: colors.text.primary }]}>
            {detail.userAnswer}
          </Text>

          <Text style={[styles.orderingLabel, { color: colors.text.secondary, marginTop: 12 }]}>
            {translations.exercise.detail.correctAnswer || 'Doğru cevap:'}
          </Text>
          <Text style={[styles.orderingText, { color: colors.success }]}>
            {detail.correctAnswer}
          </Text>
        </View>
      </View>
    );
  };

  const renderQuestionItem = (detail: QuestionDetail) => {
    const isCorrect = detail.isCorrect;
    
    return (
      <View 
        style={[
          styles.questionCard, 
          { 
            backgroundColor: colors.surface,
            borderColor: isCorrect ? colors.success : colors.error,
            borderWidth: 2,
          }
        ]}
      >
        <View style={styles.questionHeader}>
          <Text style={[styles.questionTitle, { color: colors.text.primary }]}>
            {formatString(translations.exercise.detail.questionTitle, currentQuestionIndex + 1)}
          </Text>
          <View style={[
            styles.resultBadge, 
            { backgroundColor: isCorrect ? colors.success + '40' : colors.error + '40' }
          ]}>
            <MaterialIcons 
              name={isCorrect ? 'check-circle' : 'cancel'} 
              size={18} 
              color={isCorrect ? colors.success : colors.error} 
            />
            <Text style={[
              styles.resultText, 
              { 
                color: isCorrect ? colors.success : colors.error,
                marginLeft: 4
              }
            ]}>
              {isCorrect ? translations.exercise.question.correct : translations.exercise.question.incorrect}
            </Text>
          </View>
        </View>
        
        <View style={styles.questionContent}>
          {/* Soru tipine göre uygun içeriği göster */}
          {detail.questionType === 'fillInTheBlank' 
            ? renderFillInTheBlankContent(detail)
            : detail.questionType === 'wordMatch' 
              ? renderWordMatchContent(detail)
            : detail.questionType === 'sentenceOrdering'
              ? renderSentenceOrderingContent(detail)
              : renderSentenceMatchContent(detail)
          }
        </View>
        
        <View style={styles.optionsContainer}>
          {detail.options.map((option, optionIndex) => {
            const isUserAnswer = option === detail.userAnswer;
            const isCorrectAnswer = option === detail.correctAnswer;
            
            return (
              <View
                key={optionIndex}
                style={[
                  styles.optionItem,
                  { 
                    backgroundColor: isUserAnswer 
                      ? (isCorrectAnswer ? colors.success + '10' : colors.error + '10')
                      : isCorrectAnswer 
                        ? colors.success + '10' 
                        : colors.surface,
                    borderColor: isUserAnswer 
                      ? (isCorrectAnswer ? colors.success : colors.error)
                      : isCorrectAnswer 
                        ? colors.success 
                        : colors.border,
                    borderWidth: (isUserAnswer || isCorrectAnswer) ? 1 : 1,
                  }
                ]}
              >
                <Text style={[
                  styles.optionText, 
                  { 
                    color: isUserAnswer 
                      ? (isCorrectAnswer ? colors.success : colors.error)
                      : isCorrectAnswer 
                        ? colors.success 
                        : colors.text.primary,
                    textAlign: 'center',
                  }
                ]}>
                  {option}
                </Text>
                
                {(isUserAnswer || isCorrectAnswer) && (
                  <View style={styles.optionIcon}>
                    {isUserAnswer && (
                      <MaterialIcons 
                        name={isCorrectAnswer ? 'check-circle' : 'cancel'} 
                        size={18} 
                        color={isCorrectAnswer ? colors.success : colors.error} 
                      />
                    )}
                    {!isUserAnswer && isCorrectAnswer && (
                      <MaterialIcons 
                        name="check-circle" 
                        size={18} 
                        color={colors.success} 
                      />
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
        
        {/* Sadece yanlış cevaplarda detaylı bilgi göster */}
        {!isCorrect && (
          <View style={styles.answerContainer}>
            <Text style={[styles.answerLabel, { color: colors.text.secondary }]}>
              {formatString(translations.exercise.detail.correctAnswer, detail.correctAnswer)}
            </Text>
          </View>
        )}

        {/* Doğru cevaplarda sadece "Cevabınız doğru" göster */}
        {isCorrect && (
          <View style={styles.answerContainer}>
            <Text style={[styles.correctAnswerText, { color: colors.success }]}>
              Cevabınız doğru
            </Text>
          </View>
        )}

        {/* Listeye Ekle Butonu */}
        <TouchableOpacity 
          style={[styles.addToListButton, { backgroundColor: colors.primary + '20' }]}
          onPress={openWordListModal}
        >
          <MaterialIcons name="playlist-add" size={20} color={colors.primary} />
          <Text style={[styles.addToListText, { color: colors.primary }]}>
            {translations.wordListModal?.addToList || 'Listeye Ekle'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Kelime listesi modal'ı
  const renderWordListModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={wordListModalVisible}
      onRequestClose={() => setWordListModalVisible(false)}
    >
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
              {translations.wordListModal?.title || 'Kelime Listesi Seç'}
            </Text>
            <TouchableOpacity onPress={() => setWordListModalVisible(false)}>
              <MaterialIcons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.listSelector}>
            {wordLists.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                {translations.wordListModal?.noLists || 'Henüz liste oluşturulmamış'}
              </Text>
            ) : (
              wordLists.map((list) => (
                <TouchableOpacity
                  key={list.id}
                  style={[
                    styles.listOption,
                    selectedWordList === list.id && { backgroundColor: colors.primary + '30' },
                    { borderColor: colors.border }
                  ]}
                  onPress={() => setSelectedWordList(list.id)}
                >
                  <Text style={[styles.listText, { color: colors.text.primary }]}>
                    {list.name}
                  </Text>
                  {selectedWordList === list.id && (
                    <MaterialIcons name="check" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {wordLists.length > 0 && (
            <TouchableOpacity
              style={[
                styles.addButton,
                { 
                  backgroundColor: selectedWordList ? colors.primary : colors.border,
                  opacity: selectedWordList ? 1 : 0.5
                }
              ]}
              onPress={addToWordList}
              disabled={!selectedWordList}
            >
              <Text style={[styles.addButtonText, { color: colors.text.onPrimary }]}>
                {translations.wordListModal?.addToList || 'Listeye Ekle'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Daha kompakt puan bilgisi başlığı */}
      <View style={[styles.scoreHeader, { backgroundColor: colors.surface }]}>
        <View style={styles.scoreHeaderContent}>
          <View style={styles.scoreTextContainer}>
            <View style={styles.scoreRow}>
              <MaterialIcons 
                name={score === totalQuestions ? 'emoji-events' : 'stars'} 
                size={24} 
                color={colors.primary} 
                style={styles.scoreIcon}
              />
              <Text style={[styles.scoreTitleText, { color: colors.text.primary }]}>
                {formatString(translations.exercise.detail.score, score, totalQuestions)}
              </Text>
              <Text style={[styles.exerciseTypeText, { color: colors.text.secondary }]}>
                {getWordSourceName(wordSource, wordListName, level)}
              </Text>
            </View>
            <View style={[styles.scoreBar, { backgroundColor: colors.border }]}>
              <View 
                style={[
                  styles.scoreProgress,
                  { 
                    backgroundColor: colors.primary,
                    width: `${(score / totalQuestions) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </View>
      
      <View style={styles.questionNavigation}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          {translations.exercise.detail.questionsTitle} ({currentQuestionIndex + 1}/{details.length})
        </Text>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {details.length > 0 && renderQuestionItem(details[currentQuestionIndex])}
      </ScrollView>
      
      {/* Soru navigasyon butonları */}
      <View style={[styles.navigationButtons, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.navButton,
            { 
              backgroundColor: currentQuestionIndex > 0 ? colors.primary : colors.surface,
              borderColor: colors.border,
              borderWidth: currentQuestionIndex > 0 ? 0 : 1,
              opacity: currentQuestionIndex > 0 ? 1 : 0.5,
            },
          ]}
          onPress={goToPreviousQuestion}
          disabled={currentQuestionIndex === 0}
        >
          <MaterialIcons 
            name="chevron-left" 
            size={24} 
            color={currentQuestionIndex > 0 ? colors.text.onPrimary : colors.text.secondary} 
          />
          <Text style={[
            styles.navButtonText, 
            { color: currentQuestionIndex > 0 ? colors.text.onPrimary : colors.text.secondary }
          ]}>
            Önceki
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.navButton,
            { 
              backgroundColor: currentQuestionIndex < details.length - 1 ? colors.primary : colors.surface,
              borderColor: colors.border,
              borderWidth: currentQuestionIndex < details.length - 1 ? 0 : 1,
              opacity: currentQuestionIndex < details.length - 1 ? 1 : 0.5,
            },
          ]}
          onPress={goToNextQuestion}
          disabled={currentQuestionIndex === details.length - 1}
        >
          <Text style={[
            styles.navButtonText, 
            { color: currentQuestionIndex < details.length - 1 ? colors.text.onPrimary : colors.text.secondary }
          ]}>
            Sonraki
          </Text>
          <MaterialIcons 
            name="chevron-right" 
            size={24} 
            color={currentQuestionIndex < details.length - 1 ? colors.text.onPrimary : colors.text.secondary} 
          />
        </TouchableOpacity>
      </View>

      {/* Kelime listesi modalı */}
      {renderWordListModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  scoreHeader: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: 0,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  scoreHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  scoreIcon: {
    marginRight: 8,
  },
  scoreTextContainer: {
    flex: 1,
  },
  scoreTitleText: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  exerciseTypeText: {
    fontSize: 13,
    textAlign: 'right',
  },
  scoreBar: {
    height: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreProgress: {
    height: '100%',
  },
  questionNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  questionCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  questionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  resultText: {
    fontSize: 12,
    fontWeight: '500',
  },
  questionContent: {
    marginBottom: 16,
    alignItems: 'center', // İçeriği ortala
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center', // Metni ortala
  },
  optionsContainer: {
    marginBottom: 12,
    alignItems: 'center', // Seçenekleri ortala
    width: '100%',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'center', // İçeriği ortala
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    width: '90%', // Genişliği azalt
    alignSelf: 'center', // Kendini ortala
  },
  optionText: {
    fontSize: 15,
    flex: 1,
    fontWeight: '500',
  },
  optionIcon: {
    width: 24,
    alignItems: 'center',
  },
  answerContainer: {
    marginTop: 8,
    alignItems: 'center', // Cevapları ortala
  },
  answerLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  correctAnswerText: {
    fontSize: 14,
    fontWeight: '600',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    width: '48%',
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  sentenceContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center', // Merkeze hizala
    alignItems: 'center',
    marginVertical: 16,
  },
  sentencePart: {
    fontSize: 17,
    textAlign: 'center',
    fontWeight: '500',
  },
  blankSpace: {
    width: 80,
    height: 2,
    borderBottomWidth: 2,
    marginHorizontal: 4,
  },
  wordContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  wordText: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  questionLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  addToListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'center',
  },
  addToListText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  listSelector: {
    maxHeight: 300,
    marginBottom: 20,
  },
  listOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  listText: {
    fontSize: 16,
  },
  addButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  orderingResultContainer: {
    marginTop: 16,
    width: '100%',
  },
  orderingLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  orderingText: {
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
});

export default ExerciseDetailScreen; 