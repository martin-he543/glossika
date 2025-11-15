/**
 * Text-to-Speech utility with language-specific voice selection
 */

// Initialize voices on load
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  // Some browsers need voices to be loaded
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      // Voices loaded
    }, { once: true });
  }
}

// Language code mapping for better TTS support
const LANGUAGE_CODES: Record<string, string> = {
  'japanese': 'ja-JP',
  'japanese-hiragana': 'ja-JP',
  'japanese-katakana': 'ja-JP',
  'japanese-kanji': 'ja-JP',
  'chinese': 'zh-CN',
  'chinese-simplified': 'zh-CN',
  'chinese-traditional': 'zh-TW',
  'mandarin': 'zh-CN',
  'cantonese': 'zh-HK',
  'english': 'en-US',
  'spanish': 'es-ES',
  'french': 'fr-FR',
  'german': 'de-DE',
  'italian': 'it-IT',
  'portuguese': 'pt-BR',
  'russian': 'ru-RU',
  'korean': 'ko-KR',
  'arabic': 'ar-SA',
  'hindi': 'hi-IN',
  'thai': 'th-TH',
  'vietnamese': 'vi-VN',
};

// Voice preferences by language (preferred voice names/patterns)
const VOICE_PREFERENCES: Record<string, string[]> = {
  'ja-JP': ['Japanese', 'ja-JP', 'Google 日本語', 'Microsoft Haruka', 'Microsoft Ichiro'],
  'zh-CN': ['Chinese', 'zh-CN', 'Google 普通话', 'Microsoft Kangkang', 'Microsoft Yaoyao'],
  'zh-TW': ['Chinese', 'zh-TW', 'Google 國語', 'Microsoft Zhiwei', 'Microsoft Yating'],
  'zh-HK': ['Chinese', 'zh-HK', 'Cantonese', 'Microsoft Tracy'],
  'en-US': ['English', 'en-US', 'Google US English', 'Microsoft Zira'],
  'es-ES': ['Spanish', 'es-ES', 'Google español', 'Microsoft Helena'],
  'fr-FR': ['French', 'fr-FR', 'Google français', 'Microsoft Hortense'],
  'de-DE': ['German', 'de-DE', 'Google Deutsch', 'Microsoft Hedda'],
  'it-IT': ['Italian', 'it-IT', 'Google italiano', 'Microsoft Elsa'],
  'pt-BR': ['Portuguese', 'pt-BR', 'Google português', 'Microsoft Heloisa'],
  'ru-RU': ['Russian', 'ru-RU', 'Google русский', 'Microsoft Irina'],
  'ko-KR': ['Korean', 'ko-KR', 'Google 한국어', 'Microsoft Heami'],
  'ar-SA': ['Arabic', 'ar-SA', 'Google العربية', 'Microsoft Naayf'],
  'hi-IN': ['Hindi', 'hi-IN', 'Google हिन्दी', 'Microsoft Kalpana'],
  'th-TH': ['Thai', 'th-TH', 'Google ไทย', 'Microsoft Pattara'],
  'vi-VN': ['Vietnamese', 'vi-VN', 'Google Tiếng Việt', 'Microsoft An'],
};

/**
 * Get the appropriate language code for TTS
 */
export function getLanguageCode(language: string): string {
  const normalized = language.toLowerCase().trim();
  return LANGUAGE_CODES[normalized] || normalized || 'en-US';
}

/**
 * Find the best voice for a given language code
 */
function findBestVoice(langCode: string): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    return null;
  }

  const preferences = VOICE_PREFERENCES[langCode] || [];
  
  // First, try to find a voice matching preferences
  for (const preference of preferences) {
    const voice = voices.find(v => 
      v.lang === langCode && 
      (v.name.includes(preference) || preference.includes(v.name))
    );
    if (voice) return voice;
  }

  // Fallback: find any voice with matching language code
  const langMatch = voices.find(v => v.lang === langCode || v.lang.startsWith(langCode.split('-')[0]));
  if (langMatch) return langMatch;

  // Final fallback: return first available voice
  return voices[0];
}

/**
 * Speak text using the best available voice for the language
 */
export function speakText(
  text: string,
  language: string,
  onEnd?: () => void,
  onError?: () => void
): void {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported');
    if (onError) onError();
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const langCode = getLanguageCode(language);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langCode;

  // Set up event handlers first
  utterance.onend = () => {
    if (onEnd) onEnd();
  };

  utterance.onerror = (event) => {
    console.error('Speech synthesis error:', event);
    if (onError) onError();
  };

  // Set speech rate and pitch for better quality
  utterance.rate = 0.9; // Slightly slower for clarity
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Function to set voice and speak
  const setVoiceAndSpeak = () => {
    const availableVoices = window.speechSynthesis.getVoices();
    if (availableVoices.length > 0) {
      const bestVoice = findBestVoice(langCode);
      if (bestVoice) {
        utterance.voice = bestVoice;
      }
    }
    window.speechSynthesis.speak(utterance);
  };

  // Try to find and set the best voice
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const bestVoice = findBestVoice(langCode);
    if (bestVoice) {
      utterance.voice = bestVoice;
    }
    // Speak immediately if voices are available
    window.speechSynthesis.speak(utterance);
  } else {
    // If voices aren't loaded yet, wait for them
    let attempts = 0;
    const maxAttempts = 10;
    const loadVoices = () => {
      attempts++;
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoiceAndSpeak();
      } else if (attempts < maxAttempts) {
        // Retry after a short delay
        setTimeout(loadVoices, 100);
      } else {
        // Fallback: speak without voice selection
        window.speechSynthesis.speak(utterance);
      }
    };
    
    // Listen for voiceschanged event
    const voicesChangedHandler = () => {
      setVoiceAndSpeak();
      window.speechSynthesis.removeEventListener('voiceschanged', voicesChangedHandler);
    };
    window.speechSynthesis.addEventListener('voiceschanged', voicesChangedHandler);
    
    // Also try loading immediately
    loadVoices();
  }
}

/**
 * Check if TTS is available
 */
export function isTTSAvailable(): boolean {
  return 'speechSynthesis' in window;
}

/**
 * Stop any ongoing speech
 */
export function stopSpeech(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

