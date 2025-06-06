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
    visualize: string;
    visualizeDescription: string;
    dictionary: string;
    dictionaryDescription: string;
    trackProgress: string;
    trackProgressDescription: string;
    exerciseTitle: string;
    exerciseDescription: string;
    back: string;
    next: string;
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
    subtitle: string;
    loading: string;
    wordLabel: string;
    wordDetail: {
      meaning: string;
      example: string;
    };
    buttons: {
      regenerate: string;
      continue: string;
    };
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
    loading: string;
    levels: {
      A1: string;
      A2: string;
      B1: string;
      B2: string;
      C1: string;
      C2: string;
    };
    tabs: {
      home: string;
      dictionary: string;
      stats: string;
      settings: string;
    };
  };
  wordCount: {
    title: string;
    subtitle: string;
    wordText: string;
    levelText: string;
    levels: {
      2: string;
      3: string;
      4: string;
      5: string;
    };
  };
  imageSelection: {
    title: string;
    subtitle: string;
    loading: string;
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
      learningLanguage: string;
      update: string;
      noData: string;
      updateSuccess: string;
      updateError: string;
    };
  };
  wordOverlay: {
    preview: string;
    styleSection: string;
    positionSection: string;
    fontSize: string;
    xPosition: string;
    yPosition: string;
    wordFormat: string;
    layoutPosition: string;
    layoutPositions: {
      top: string;
      middle: string;
      bottom: string;
    };
    formatTypes: {
      standard: string;
      inline: string;
      compact: string;
      flashcard: string;
      dictionary: string;
      quiz: string;
      poetic: string;
      bubble: string;
      memo: string;
      modern: string;
    };
    saveButton: string;
    customizeButton: string;
    homeButton: string;
    color: string;
    font: string;
    defaultFont: string;
    layout: string;
    layoutTypes: {
      plain: string;
      box: string;
      gradient: string;
      shadow: string;
      outline: string;
      minimal: string;
      card3d: string;
      neon: string;
      vintage: string;
      watercolor: string;
      boxShadow: string;
    };
    horizontal: string;
    vertical: string;
    pronunciation: string;
    wordTitle: string;
    saveSuccess: string;
    saveError: string;
    savePermissionError: string;
    saveWarning: string;
    saveConfirm: string;
    saveCancel: string;
    wordsSaved: string;
    congratulations: string;
    complete: string;
    continueButton: string;
    closeButton: string;
    restartButton: string;
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
      empty: string;
    };
    historyItem: {
      date: string;
      score: string;
      type: string;
    };
    tabs: {
      exercise: string;
      stats: string;
      settings: string;
    };
  };
} 