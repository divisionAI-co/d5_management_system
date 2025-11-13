/**
 * Utility functions for automatic field mapping based on name similarity.
 * Used across all import modules to suggest initial column mappings.
 */

export interface FieldMetadata {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
}

export interface SuggestedMapping {
  sourceColumn: string;
  targetField: string;
  confidence: number; // 0-1, where 1 is exact match
}

/**
 * Calculates the similarity between two strings using a combination of:
 * - Exact match (case-insensitive)
 * - Contains match
 * - Levenshtein distance (normalized)
 * - Word overlap
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.trim().toLowerCase();
  const s2 = str2.trim().toLowerCase();

  // Exact match
  if (s1 === s2) {
    return 1.0;
  }

  // One contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.9;
  }

  // Word-based matching
  const words1 = s1.split(/\s+|[-_]/).filter((w) => w.length > 0);
  const words2 = s2.split(/\s+|[-_]/).filter((w) => w.length > 0);

  // Count matching words
  const matchingWords = words1.filter((w1) =>
    words2.some((w2) => w1 === w2 || w1.includes(w2) || w2.includes(w1)),
  );
  const wordOverlap = matchingWords.length / Math.max(words1.length, words2.length);

  // Levenshtein distance (normalized)
  const maxLength = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  const normalizedDistance = 1 - distance / maxLength;

  // Combine scores (weighted average)
  return wordOverlap * 0.6 + normalizedDistance * 0.4;
}

/**
 * Calculates Levenshtein distance between two strings.
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Suggests field mappings based on column name similarity.
 * 
 * @param columns - Array of column names from the uploaded file
 * @param fieldDefinitions - Array of field metadata with labels to match against
 * @param minConfidence - Minimum confidence threshold (0-1) for suggestions (default: 0.3)
 * @returns Array of suggested mappings sorted by confidence (highest first)
 */
export function suggestFieldMappings<T extends FieldMetadata>(
  columns: string[],
  fieldDefinitions: T[],
  minConfidence = 0.3,
): SuggestedMapping[] {
  const suggestions: SuggestedMapping[] = [];
  const usedColumns = new Set<string>();
  const usedFields = new Set<string>();

  // Calculate similarity for all column-field pairs
  const allMatches: Array<{
    column: string;
    field: T;
    confidence: number;
  }> = [];

  for (const column of columns) {
    for (const field of fieldDefinitions) {
      const confidence = calculateSimilarity(column, field.label);
      if (confidence >= minConfidence) {
        allMatches.push({ column, field, confidence });
      }
    }
  }

  // Sort by confidence (highest first)
  allMatches.sort((a, b) => b.confidence - a.confidence);

  // Greedy assignment: assign best matches first, avoiding duplicates
  for (const match of allMatches) {
    if (!usedColumns.has(match.column) && !usedFields.has(match.field.key)) {
      suggestions.push({
        sourceColumn: match.column,
        targetField: match.field.key,
        confidence: match.confidence,
      });
      usedColumns.add(match.column);
      usedFields.add(match.field.key);
    }
  }

  return suggestions;
}

/**
 * Generates initial mapping suggestions for a set of columns.
 * This is a convenience function that returns mappings in the format expected by the API.
 * 
 * @param columns - Array of column names from the uploaded file
 * @param fieldDefinitions - Array of field metadata with labels to match against
 * @param minConfidence - Minimum confidence threshold (0-1) for suggestions (default: 0.3)
 * @returns Array of mapping objects with sourceColumn and targetField
 */
export function generateInitialMappings<T extends FieldMetadata>(
  columns: string[],
  fieldDefinitions: T[],
  minConfidence = 0.3,
): Array<{ sourceColumn: string; targetField: string }> {
  const suggestions = suggestFieldMappings(columns, fieldDefinitions, minConfidence);
  return suggestions.map((s) => ({
    sourceColumn: s.sourceColumn,
    targetField: s.targetField,
  }));
}

