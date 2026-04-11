import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tiny pub/sub around the `hasSeenOnboarding` AsyncStorage flag. App.tsx
 * subscribes to this so the navigator re-renders (and swaps the stack from
 * Onboarding → main) the moment onboarding completes, without any manual
 * navigation.replace() calls.
 *
 * Also manages a one-shot "pending auth prompt" flag. When onboarding
 * finishes it is armed to true and PERSISTED to AsyncStorage, so that even
 * if React reloads or the process restarts before we've routed to Auth,
 * the prompt still fires on the next boot. As soon as the navigator has
 * actually landed the user on the Auth screen it calls clearPendingAuthPrompt
 * and the flag is gone forever.
 */
type Listener = (hasSeenOnboarding: boolean) => void;

const ONBOARDING_SEEN_KEY = 'hasSeenOnboarding';
const AUTH_PROMPT_KEY = 'pendingAuthPromptAfterOnboarding';

class OnboardingState {
  private listeners = new Set<Listener>();
  private value: boolean | null = null;
  // Cached mirror of the AUTH_PROMPT_KEY in AsyncStorage. Loaded on boot
  // by load() and flipped by markSeen() / clearPendingAuthPrompt().
  private pendingAuthPrompt = false;

  async load(): Promise<boolean> {
    const [seenRaw, promptRaw] = await Promise.all([
      AsyncStorage.getItem(ONBOARDING_SEEN_KEY),
      AsyncStorage.getItem(AUTH_PROMPT_KEY),
    ]);
    this.value = seenRaw === 'true';
    this.pendingAuthPrompt = promptRaw === 'true';
    return this.value;
  }

  get(): boolean | null {
    return this.value;
  }

  async markSeen(): Promise<void> {
    // Persist both flags together so that a process death right after
    // this call still honors the pending prompt on the next boot.
    await AsyncStorage.multiSet([
      [ONBOARDING_SEEN_KEY, 'true'],
      [AUTH_PROMPT_KEY, 'true'],
    ]);
    this.value = true;
    this.pendingAuthPrompt = true;
    this.emit();
  }

  hasPendingAuthPrompt(): boolean {
    return this.pendingAuthPrompt;
  }

  clearPendingAuthPrompt(): void {
    if (!this.pendingAuthPrompt) return;
    this.pendingAuthPrompt = false;
    // Fire-and-forget: losing the clear on a crash just means the user
    // sees the prompt once more, which is acceptable.
    AsyncStorage.removeItem(AUTH_PROMPT_KEY).catch(() => undefined);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    for (const l of this.listeners) l(this.value === true);
  }
}

export const onboardingState = new OnboardingState();
