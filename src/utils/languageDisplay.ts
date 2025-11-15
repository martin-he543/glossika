// Utility function to get language display name
export function getLanguageDisplayName(language: string, course?: { nativeLanguage: string; targetLanguage: string }): string {
  // If it's a standard language name, return as is
  if (language && language !== 'Native' && language !== 'Target') {
    return language;
  }
  
  // Fallback to course languages if available
  if (course) {
    if (language === 'Native' || !language) {
      return course.nativeLanguage;
    }
    if (language === 'Target') {
      return course.targetLanguage;
    }
  }
  
  return language || 'Unknown';
}

// Get direction display with actual language names
export function getDirectionDisplay(
  direction: 'native-to-target' | 'target-to-native',
  nativeLanguage: string,
  targetLanguage: string
): string {
  if (direction === 'native-to-target') {
    return `${nativeLanguage} → ${targetLanguage}`;
  }
  return `${targetLanguage} → ${nativeLanguage}`;
}

