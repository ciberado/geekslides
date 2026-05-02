import type { PreprocessorResult } from './types.ts';

export interface PreprocessedMarkdown {
  readonly content: string;
  readonly lineMapping: readonly number[];
}

export function createIdentityLineMapping(content: string): number[] {
  return content.split('\n').map((_, index) => index + 1);
}

export function composeLineMappings(
  previousMapping: readonly number[],
  nextMapping: readonly number[],
): number[] {
  return nextMapping.map((lineNumber) => previousMapping[lineNumber - 1] ?? lineNumber);
}

export function normalizePreprocessorResult(result: PreprocessorResult): PreprocessedMarkdown {
  if (typeof result === 'string') {
    return {
      content: result,
      lineMapping: createIdentityLineMapping(result),
    };
  }

  const lineMapping = result.lineMapping ?? createIdentityLineMapping(result.content);
  return {
    content: result.content,
    lineMapping,
  };
}

export function applyPreprocessorResult(
  previous: PreprocessedMarkdown,
  result: PreprocessorResult,
): PreprocessedMarkdown {
  const normalized = normalizePreprocessorResult(result);
  return {
    content: normalized.content,
    lineMapping: composeLineMappings(previous.lineMapping, normalized.lineMapping),
  };
}
