export function detectLanguage(text: string): string {
  // Skip detection for very short texts (less than 3 words)
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 3) {
    // For very short texts, rely on accents as a stronger signal
    return /[éèêëàâäôöûüçîï]/i.test(text) ? 'fr' : 'en';
  }
  
  // French-specific words that don't commonly appear in English
  const distinctFrenchWords = ['une', 'deux', 'trois', 'cette', 'dans', 'avec', 'pour', 'sont', 'nous', 'vous', 'ils', 'elles', 'mon', 'ton', 'votre', 'notre', 'leur'];
  
  // Common words like "the", "of", "and" appear in both languages, so we focus on more distinct words
  const textToCheck = text.toLowerCase();
  
  // Count French-specific words (stronger signal)
  const frenchWordCount = distinctFrenchWords.filter(word => 
    textToCheck.includes(` ${word} `) || 
    textToCheck.startsWith(`${word} `) || 
    textToCheck.endsWith(` ${word}`)
  ).length;
  
  // Check for French accents (strong signal)
  const hasFrenchAccents = /[éèêëàâäôöûüçîï]/i.test(textToCheck);
  
  // More reliable detection:
  // 1. Multiple French-specific words
  // 2. Presence of French accents + at least one French word
  if (frenchWordCount >= 2 || (hasFrenchAccents && frenchWordCount >= 1)) {
    return 'fr';
  }
  
  // Default to English
  return 'en';
} 