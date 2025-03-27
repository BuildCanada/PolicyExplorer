"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectLanguage = detectLanguage;
function detectLanguage(text) {
    const frenchWords = ['le', 'la', 'les', 'un', 'une', 'des', 'et', 'en', 'de', 'du', 'des'];
    const frenchPatterns = /[éèêëàâäôöûüçîï]|(le|la|les|un|une|des)\s/i;
    const textToCheck = text.toLowerCase();
    // Count French words
    const frenchWordCount = frenchWords.filter(word => textToCheck.includes(` ${word} `) ||
        textToCheck.startsWith(`${word} `) ||
        textToCheck.endsWith(` ${word}`)).length;
    // Check for French patterns
    const hasFrenchPatterns = frenchPatterns.test(textToCheck);
    // If we find French words or patterns, mark as French
    if (frenchWordCount > 2 || hasFrenchPatterns) {
        return 'fr';
    }
    // Default to English
    return 'en';
}
