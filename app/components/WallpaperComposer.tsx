import React, { forwardRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ImageBackground,
  ImageSourcePropType,
} from 'react-native';
import ViewShot from 'react-native-view-shot';

import type { Word } from '../types/words';
import type { WordFormat } from '../services/autoWallpaper';

/**
 * Standalone wallpaper renderer for the auto lock-screen feature.
 *
 * Supports 4 layouts (standard, flashcard, modern, bubble) — a subset
 * of what WordOverlayScreen offers. This is intentional: the auto
 * feature is meant to be simple, and keeping the layouts decoupled
 * from WordOverlayScreen avoids a risky refactor of shipped code.
 *
 * Designed to be rendered offscreen (e.g. absolute-positioned far off
 * the visible area) by the settings screen, captured via ViewShot,
 * then handed to the native module for caching.
 */

export type WallpaperComposerLayout = Extract<
  WordFormat,
  'standard' | 'flashcard' | 'modern' | 'bubble'
>;

export const AUTO_WALLPAPER_LAYOUTS: WallpaperComposerLayout[] = [
  'standard',
  'flashcard',
  'modern',
  'bubble',
];

interface WallpaperComposerProps {
  words: Word[];
  layout: WallpaperComposerLayout;
  backgroundImage: ImageSourcePropType;
  /** Override width/height (defaults to device screen) */
  width?: number;
  height?: number;
}

export const WallpaperComposer = forwardRef<ViewShot, WallpaperComposerProps>(
  ({ words, layout, backgroundImage, width, height }, ref) => {
    const screen = Dimensions.get('screen');
    const w = width ?? screen.width;
    const h = height ?? screen.height;

    const styles = useMemo(() => createStyles(w, h), [w, h]);

    return (
      <ViewShot
        ref={ref}
        options={{ format: 'png', quality: 1, result: 'tmpfile' }}
        style={[styles.shot, { width: w, height: h }]}
      >
        <ImageBackground
          source={backgroundImage}
          style={styles.background}
          resizeMode="cover"
        >
          <View style={styles.overlay}>
            <View style={styles.wordsContainer}>
              {words.map((word, idx) => (
                <WordBlock key={`${word.word}-${idx}`} word={word} layout={layout} />
              ))}
            </View>
          </View>
        </ImageBackground>
      </ViewShot>
    );
  }
);

WallpaperComposer.displayName = 'WallpaperComposer';

// ---- Layout variants ----

interface WordBlockProps {
  word: Word;
  layout: WallpaperComposerLayout;
}

const WordBlock: React.FC<WordBlockProps> = ({ word, layout }) => {
  switch (layout) {
    case 'flashcard':
      return <FlashcardBlock word={word} />;
    case 'modern':
      return <ModernBlock word={word} />;
    case 'bubble':
      return <BubbleBlock word={word} />;
    case 'standard':
    default:
      return <StandardBlock word={word} />;
  }
};

const StandardBlock: React.FC<{ word: Word }> = ({ word }) => (
  <View style={layoutStyles.standard.container}>
    <Text style={layoutStyles.standard.word} numberOfLines={1}>
      {word.word}
    </Text>
    <Text style={layoutStyles.standard.meaning} numberOfLines={2}>
      {word.meaning}
    </Text>
    {word.example ? (
      <Text style={layoutStyles.standard.example} numberOfLines={2}>
        {word.example}
      </Text>
    ) : null}
  </View>
);

const FlashcardBlock: React.FC<{ word: Word }> = ({ word }) => (
  <View style={layoutStyles.flashcard.container}>
    <Text style={layoutStyles.flashcard.word} numberOfLines={1}>
      {word.word}
    </Text>
    <View style={layoutStyles.flashcard.divider} />
    <Text style={layoutStyles.flashcard.meaning} numberOfLines={2}>
      {word.meaning}
    </Text>
  </View>
);

const ModernBlock: React.FC<{ word: Word }> = ({ word }) => (
  <View style={layoutStyles.modern.container}>
    <View style={layoutStyles.modern.accent} />
    <View style={layoutStyles.modern.textWrap}>
      <Text style={layoutStyles.modern.word} numberOfLines={1}>
        {word.word}
      </Text>
      <Text style={layoutStyles.modern.meaning} numberOfLines={2}>
        {word.meaning}
      </Text>
    </View>
  </View>
);

const BubbleBlock: React.FC<{ word: Word }> = ({ word }) => (
  <View style={layoutStyles.bubble.container}>
    <Text style={layoutStyles.bubble.word} numberOfLines={1}>
      {word.word}
    </Text>
    <Text style={layoutStyles.bubble.meaning} numberOfLines={2}>
      {word.meaning}
    </Text>
  </View>
);

// ---- Styles ----

const createStyles = (w: number, h: number) =>
  StyleSheet.create({
    shot: {
      backgroundColor: '#000',
    },
    background: {
      width: w,
      height: h,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.35)',
      paddingHorizontal: w * 0.08,
      paddingVertical: h * 0.15,
      justifyContent: 'center',
    },
    wordsContainer: {
      width: '100%',
    },
  });

const layoutStyles = {
  standard: StyleSheet.create({
    container: {
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      borderRadius: 14,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    word: {
      color: '#fff',
      fontSize: 26,
      fontWeight: '700',
      marginBottom: 6,
    },
    meaning: {
      color: '#fff',
      fontSize: 18,
      opacity: 0.95,
      marginBottom: 4,
    },
    example: {
      color: '#fff',
      fontSize: 14,
      fontStyle: 'italic',
      opacity: 0.75,
    },
  }),
  flashcard: StyleSheet.create({
    container: {
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
      borderRadius: 16,
      padding: 20,
      marginBottom: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 6,
    },
    word: {
      color: '#111',
      fontSize: 28,
      fontWeight: '800',
      textAlign: 'center',
    },
    divider: {
      height: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      marginVertical: 10,
      width: '60%',
      alignSelf: 'center',
    },
    meaning: {
      color: '#333',
      fontSize: 18,
      textAlign: 'center',
    },
  }),
  modern: StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      borderRadius: 8,
      padding: 14,
      marginBottom: 12,
      alignItems: 'center',
    },
    accent: {
      width: 4,
      height: '100%',
      backgroundColor: '#4A90E2',
      borderRadius: 2,
      marginRight: 14,
    },
    textWrap: {
      flex: 1,
    },
    word: {
      color: '#fff',
      fontSize: 22,
      fontWeight: '700',
      marginBottom: 4,
    },
    meaning: {
      color: '#fff',
      fontSize: 16,
      opacity: 0.9,
    },
  }),
  bubble: StyleSheet.create({
    container: {
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      borderRadius: 28,
      paddingHorizontal: 22,
      paddingVertical: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    word: {
      color: '#fff',
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 4,
    },
    meaning: {
      color: '#fff',
      fontSize: 16,
      opacity: 0.9,
    },
  }),
};
