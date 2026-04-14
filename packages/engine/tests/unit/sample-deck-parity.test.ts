import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parse } from '../../src/core/SlideParser.ts';
import { headerPreprocessor } from '../../src/plugins/builtins/header-preprocessor.ts';

interface SampleDeckConfig {
  readonly title: string;
  readonly content: string;
  readonly plugins?: {
    readonly preprocessors?: readonly string[];
  };
}

const PREPROCESSORS = {
  header: headerPreprocessor,
};

async function loadAwsSampleSlides() {
  const configUrl = new URL('../../../../decks/slides-cuatro-cosas-aws/config.json', import.meta.url);
  const rawConfig = JSON.parse(await readFile(configUrl, 'utf8')) as SampleDeckConfig;

  let markdown = await readFile(new URL(rawConfig.content, configUrl), 'utf8');
  for (const preprocessorName of rawConfig.plugins?.preprocessors ?? []) {
    const preprocessor = PREPROCESSORS[preprocessorName as keyof typeof PREPROCESSORS];
    if (preprocessor) {
      markdown = preprocessor(markdown);
    }
  }

  return {
    config: rawConfig,
    slides: parse(markdown),
  };
}

describe('AWS sample deck parity', () => {
  it('parses the sample deck with the configured preprocessor pipeline', async () => {
    const { config, slides } = await loadAwsSampleSlides();

    expect(config.title).toBe('4 Cosicas Sobre Tus Servicios Favoritos');
    expect(slides).toHaveLength(13);
    expect(slides.filter((slide) => slide.notesHtml)).toHaveLength(8);
    expect(slides.filter((slide) => slide.detailsHtml)).toHaveLength(6);
    expect(slides.filter((slide) => slide.partialCount > 0).map((slide) => ({
      id: slide.id,
      partialCount: slide.partialCount,
    }))).toEqual([
      { id: 'slide-3', partialCount: 6 },
      { id: 'slide-4', partialCount: 2 },
      { id: 'rds-aurora', partialCount: 3 },
      { id: 'asg', partialCount: 5 },
      { id: 'alb', partialCount: 3 },
      { id: 'cloudfront', partialCount: 3 },
    ]);
    expect(slides.map((slide) => slide.id)).toEqual([
      'slide-1',
      'slide-2',
      'the-good-things',
      'storage',
      'slide-3',
      'slide-4',
      'rds-aurora',
      'compute',
      'asg',
      'traffic',
      'alb',
      'cloudfront',
      'javi',
    ]);
  });

  it('extracts speaker notes from the sample deck without leaking them into slide html', async () => {
    const { slides } = await loadAwsSampleSlides();

    expect(slides[0]!.notesHtml).toContain('Zaragoza and Ebro view from the highest tower');
    expect(slides[1]!.notesHtml).toContain('240 different services.');
    expect(slides[1]!.notesHtml).toContain('AWS Service Management Connector');

    expect(slides[0]!.html).not.toContain('Zaragoza and Ebro view from the highest tower');
    expect(slides[1]!.html).not.toContain('240 different services.');
    expect(slides.every((slide) => !slide.html.includes('[partial]'))).toBe(true);
  });
});