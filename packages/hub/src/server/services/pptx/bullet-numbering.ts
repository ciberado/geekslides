/**
 * Server-side port of setNumericBullets() from pptx2html/src/main.js.
 *
 * Resolves numeric bullet placeholders (<span class="numeric-bullet-style">)
 * inside .block divs and table cells. Uses jsdom for DOM traversal, removing
 * the jQuery dependency from the original.
 *
 * Bullet types: arabicPeriod, arabicParenR, alphaLc/UcParenR/Period,
 * romanUc/LcPeriod/ParenR, hebrew2Minus.
 */

import { JSDOM } from 'jsdom';

export function resolveNumericBullets(slideHtml: string): string {
  const dom = new JSDOM(`<div id="root">${slideHtml}</div>`);
  const { document } = dom.window;

  const containers = [
    ...document.querySelectorAll('.block'),
    ...document.querySelectorAll('table td'),
  ];

  for (const container of containers) {
    const spans = [...container.querySelectorAll('.numeric-bullet-style')];
    if (spans.length === 0) continue;

    let prevType = '';
    let prevLevel = '';
    let index = 0;
    // stack: saved indices when indenting
    const indexStack: number[] = [];
    const typeStack: string[] = [];
    let stackPos = 0;

    for (const span of spans) {
      const bulletType = span.getAttribute('data-bulltname') ?? '';
      const bulletLevel = span.getAttribute('data-bulltlvl') ?? '';

      if (index === 0) {
        prevType = bulletType;
        prevLevel = bulletLevel;
        indexStack[stackPos] = index;
        typeStack[stackPos] = bulletType;
        index++;
      } else {
        if (bulletType === prevType && bulletLevel === prevLevel) {
          index++;
          indexStack[stackPos] = index;
          typeStack[stackPos] = bulletType;
        } else if (bulletType !== prevType && bulletLevel === prevLevel) {
          stackPos++;
          indexStack[stackPos] = index;
          typeStack[stackPos] = bulletType;
          index = 1;
        } else if (bulletType !== prevType && Number(bulletLevel) > Number(prevLevel)) {
          stackPos++;
          indexStack[stackPos] = index;
          typeStack[stackPos] = bulletType;
          index = 1;
        } else if (bulletType !== prevType && Number(bulletLevel) < Number(prevLevel)) {
          stackPos--;
          index = (indexStack[stackPos] ?? 0) + 1;
        }
        prevType = bulletType;
        prevLevel = bulletLevel;
      }

      span.innerHTML = formatBullet(typeStack[stackPos] ?? bulletType, index);
    }
  }

  return document.getElementById('root')?.innerHTML ?? slideHtml;
}

// ─── number formatters ────────────────────────────────────────────────────────

function formatBullet(bulletType: string, n: number): string {
  switch (bulletType) {
    case 'arabicPeriod':  return `${String(n)}. `;
    case 'arabicParenR':  return `${String(n)}) `;
    case 'alphaLcParenR': return `${alphaNumeric(n, false)}) `;
    case 'alphaLcPeriod': return `${alphaNumeric(n, false)}. `;
    case 'alphaUcParenR': return `${alphaNumeric(n, true)}) `;
    case 'alphaUcPeriod': return `${alphaNumeric(n, true)}. `;
    case 'romanUcPeriod': return `${romanize(n)}. `;
    case 'romanLcParenR': return `${romanize(n).toLowerCase()}) `;
    case 'hebrew2Minus':  return `${hebrewFormat(n)}-`;
    default:              return String(n);
  }
}

function alphaNumeric(n: number, upper: boolean): string {
  const letter = String.fromCharCode(96 + ((n - 1) % 26) + 1);
  return upper ? letter.toUpperCase() : letter;
}

function romanize(n: number): string {
  if (!n) return '';
  const digits = String(n).split('');
  const key = [
    '', 'C', 'CC', 'CCC', 'CD', 'D', 'DC', 'DCC', 'DCCC', 'CM',
    '', 'X', 'XX', 'XXX', 'XL', 'L', 'LX', 'LXX', 'LXXX', 'XC',
    '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX',
  ];
  let roman = '';
  let i = 3;
  while (i--) roman = (key[(+(digits.pop() ?? '0')) + i * 10] ?? '') + roman;
  return 'M'.repeat(+digits.join('')) + roman;
}

const HEBREW_TABLE: Array<[number | RegExp, string]> = [
  [1000, ''], [400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'],
  [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'],
  [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'], [9, 'ט'], [8, 'ח'],
  [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א'],
  [/יה/, 'ט״ו'], [/יו/, 'ט״ז'],
  [/([א-ת])([א-ת])$/, '$1״$2'],
  [/^([א-ת])$/, '$1׳'],
];

function hebrewFormat(n: number): string {
  let ret = '';
  let remaining = n;
  for (const [num, str] of HEBREW_TABLE) {
    if (typeof num === 'number' && num > 0) {
      while (remaining >= num) { ret += str; remaining -= num; }
    } else if (num instanceof RegExp) {
      ret = ret.replace(num, str);
    }
  }
  return ret;
}
