export interface Translations {
  onboarding: {
    languageSelection: string;
    learningLanguage: string;
    nativeLanguage: string;
    continue: string;
    welcome: string;
    welcomeDescription: string;
    selectLevel: string;
    selectLevelDescription: string;
    selectLevelButton: string;
    selectLevelButtonDescription: string;
    back: string;
    start: string;
  };
  languages: {
    tr: string;
    pt: string;
    es: string;
    en: string;
  };
  dataLoader: {
    loading: string;
    completed: string;
    error: string;
    progress: string;
    pleaseWait: string;
    loadingImages: string;
  };
  notifications: {
    dailyReminderTitle: string;
    dailyReminderBody: string;
    dailyWordReminder: string;
    dailyWordReminderBody: string;
  };
  stats: {
    title: string;
    totalWords: string;
    wordLists: string;
    learnedWords: string;
    levels: {
      all: string;
      allDescription: string;
      beginner: string;
      elementary: string;
      preIntermediate: string;
      upperIntermediate: string;
      advanced: string;
      proficiency: string;
      examPrep: string;
      dictionary: string;
    };
    noWords: {
      allLevels: string;
      specificLevel: string;
      subtext: string;
    };
    reinforcement: {
      info: string;
      button: string;
    };
  };
  languageSelector: {
    title: string;
    description: string;
    nativeLanguage: string;
    learningLanguage: string;
    note: string;
    info: string;
  };
  wordList: {
    title: string;
    description: string;
    searchPlaceholder: string;
    selectedWords: string;
    continueButton: string;
    clearButton: string;
  };
  home: {
    title: string;
    subtitle: string;
    learnWords: string;
    statistics: string;
    settings: string;
  };
  levelSelection: {
    title: string;
    subtitle: string;
    tabs: {
      home: string;
      dictionary: string;
      stats: string;
      settings: string;
    };
  };
  wordCount: {
    title: string;
    description: string;
    wordCountLabel: string;
    continueButton: string;
  };
  imageSelection: {
    title: string;
    description: string;
    searchPlaceholder: string;
    continueButton: string;
  };
  dictionaryScreen: {
    title: string;
    wordCount: string;
    infoText: string;
    searchPlaceholder: string;
    examplePrefix: string;
    continueButton: string;
    loadingMore: string;
    levelFilter: string;
    allLevels: string;
    selectMinWords: string;
    continueWithWords: string;
    maxWordsLimit: string;
    searchPrompt: string;
    noResults: string;
  };
  wordListModal: {
    title: string;
    newListPlaceholder: string;
    create: string;
    error: string;
    success: string;
    emptyListName: string;
    createError: string;
    addSuccess: string;
    addError: string;
    noLists: string;
  };
  settings: {
    title: string;
    themeSelection: string;
    themeDescription: string;
    themes: {
      light: {
        label: string;
        description: string;
      };
      dark: {
        label: string;
        description: string;
      };
      pastel: {
        label: string;
        description: string;
      };
    };
    notifications: string;
    notificationTime: string;
    offlineMode: string;
    offlineModeDescription: string;
    lastUpdated: string;
    downloadingData: string;
    downloadAll: string;
    updateData: string;
    downloadedData: {
      title: string;
      description: string;
      updateButton: string;
      lastUpdate: string;
    };
  };
  wordOverlay: {
    preview: string;
    saveButton: string;
    customizeButton: string;
    homeButton: string;
  };
  alerts: {
    permissionRequired: string;
    galleryPermission: string;
    error: string;
    processingError: string;
    success: string;
    imageSaved: string;
    imageSavedWithTip: string;
    imageAndWordsSaved: string;
    okay: string;
    dataDownloadSuccess: string;
    dataDownloadError: string;
    dataSyncSuccess: string;
    dataSyncError: string;
    notificationSchedulingError: string;
    notificationCancellationError: string;
  };
  exercise: {
    title: string;
    subtitle: string;
    noWords: string;
    start: string;
    history: string;
    score: string;
    learnedWordsExercise: string;
    learnedWordsExerciseDesc: string;
    dictionaryExercise: string;
    dictionaryExerciseDesc: string;
    exerciseOptions: string;
    selectLevel: string;
    startExercise: string;
    learnedSource: string;
    dictionarySource: string;
    exercises: {
      fillInTheBlank: string;
      wordMatch: string;
      mixed: string;
      sentenceMatch: string;
    };
    question: {
      title: string;
      screenTitle: string;
      fillInTheBlank: string;
      wordMatch: string;
      sentenceMatchQuestionPrompt: string;
      correct: string;
      incorrect: string;
      correctAnswer: string;
      next: string;
      finish: string;
    };
    result: {
      title: string;
      score: string;
      perfect: string;
      great: string;
      good: string;
      needsPractice: string;
      tryAgain: string;
      backToExercises: string;
      date: string;
    };
    egsersizeHistory: {
      title: string;
    };
    historyItem: {
      score: string;
    };
    tabs: {
      exercise: string;
    };
  };
  more: {
    title: string;
  };
  grammar: {
    title: string;
    subtitle: string;
    comingSoon: string;
    selectLevel: string;
  };
  dictionary: {
    title: string;
    close: string;
  };
} 