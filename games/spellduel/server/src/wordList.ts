import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadLines(filename: string): string[] {
  return readFileSync(join(__dirname, 'words', filename), 'utf-8')
    .split('\n')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
}

// words_full includes all valid guesses (superset of answer words).
const validGuessSet = new Set<string>(loadLines('words_full.txt'));

// words_ans is the smaller pool of common words used as round answers.
const answerPool: string[] = loadLines('words_ans.txt');

export function isValidGuess(word: string): boolean {
  return validGuessSet.has(word.toLowerCase());
}

/**
 * Picks `count` distinct random words from the answer pool.
 * Shuffles a copy of the pool via Fisher-Yates and takes the first `count`.
 */
export function pickRandomWords(count: number): string[] {
  const pool = [...answerPool];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
