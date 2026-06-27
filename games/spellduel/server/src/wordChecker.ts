import type { LetterResult, LetterState } from '@cup/spellduel-shared';

/**
 * Scores a 5-letter guess against the answer using standard Wordle rules:
 *   correct  = right letter, right position (green)
 *   present  = right letter, wrong position (yellow)
 *   absent   = letter not in the remaining unmatched answer letters (grey)
 *
 * Duplicate-letter handling: greens are resolved first and consume the letter
 * from the answer pool. Remaining positions are then awarded 'present' only
 * while unmatched copies of that letter still exist in the answer.
 *
 * Example: answer="HELLO", guess="LLAMA"
 *   Pass 1 greens: none
 *   Remaining answer pool: {H:1, E:1, L:2, O:1}
 *   Pass 2:
 *     L → present (pool L: 2→1)
 *     L → present (pool L: 1→0)
 *     A → absent
 *     M → absent
 *     A → absent
 */
export function checkGuess(guess: string, answer: string): LetterResult[] {
  const g = guess.toLowerCase();
  const a = answer.toLowerCase();

  const states: LetterState[] = Array(5).fill('absent');

  // Tally unmatched answer letters (skip positions with a green match).
  const pool = new Map<string, number>();
  for (let i = 0; i < 5; i++) {
    if (g[i] === a[i]) {
      states[i] = 'correct';
    } else {
      pool.set(a[i], (pool.get(a[i]) ?? 0) + 1);
    }
  }

  // Second pass: award 'present' while pool still has copies of the letter.
  for (let i = 0; i < 5; i++) {
    if (states[i] === 'correct') continue;
    const letter = g[i];
    const remaining = pool.get(letter) ?? 0;
    if (remaining > 0) {
      states[i] = 'present';
      pool.set(letter, remaining - 1);
    }
  }

  return states.map((state, i) => ({ letter: g[i], state }));
}
