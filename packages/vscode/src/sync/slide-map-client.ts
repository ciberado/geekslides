export interface SlideMapEntry {
  readonly slideIndex: number;
  readonly sourceLineStart: number;
  readonly sourceLineEnd: number;
  readonly id: string;
}

export class SlideMapClient {
  #entries: SlideMapEntry[] = [];
  readonly #fetch: typeof fetch;

  constructor(fetchImpl: typeof fetch = fetch) {
    this.#fetch = fetchImpl;
  }

  get entries(): readonly SlideMapEntry[] {
    return this.#entries;
  }

  async refresh(baseUrl: string): Promise<readonly SlideMapEntry[]> {
    try {
      const response = await this.#fetch(new URL('/api/slide-map', baseUrl));
      if (!response.ok) {
        throw new Error(`Failed to load slide map: HTTP ${String(response.status)}`);
      }

      const parsed: unknown = await response.json();
      if (!Array.isArray(parsed)) {
        throw new Error('Slide map response must be an array');
      }

      this.#entries = parsed.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) {
          return [];
        }
        const record = entry as Record<string, unknown>;
        if (
          typeof record['slideIndex'] !== 'number' ||
          typeof record['sourceLineStart'] !== 'number' ||
          typeof record['sourceLineEnd'] !== 'number' ||
          typeof record['id'] !== 'string'
        ) {
          return [];
        }

        return [{
          slideIndex: record['slideIndex'],
          sourceLineStart: record['sourceLineStart'],
          sourceLineEnd: record['sourceLineEnd'],
          id: record['id'],
        }];
      });

      return this.#entries;
    } catch (error) {
      // Network error or server not running - preserve existing entries
      // This allows sync to continue working with stale slide map
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[slide-map-client] Failed to refresh slide map: ${message}`);
      return this.#entries;
    }
  }

  getSlideForLine(line: number): number | undefined {
    const sourceLine = line + 1;
    return this.#entries.find((entry) => (
      sourceLine >= entry.sourceLineStart && sourceLine < entry.sourceLineEnd
    ))?.slideIndex;
  }

  getLineForSlide(slideIndex: number): number | undefined {
    const entry = this.#entries.find((candidate) => candidate.slideIndex === slideIndex);
    return entry ? entry.sourceLineStart - 1 : undefined;
  }
}
