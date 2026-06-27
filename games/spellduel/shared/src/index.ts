// ---- Letter / board primitives ---- //

export type LetterState = 'correct' | 'present' | 'absent';
export type LetterResult = { letter: string; state: LetterState };

// ---- Match config ---- //

export type BoardCount = 3 | 5;
export type RoundCount = 1 | 3 | 5 | 10;
export type TurnDurationSec = 0 | 30 | 60 | 90;

export type MatchSettings = {
  boardCount: BoardCount;
  rounds: RoundCount;
  turnDurationSec: TurnDurationSec;
};

// ---- Match lifecycle ---- //

export type MatchPhase = 'PRE_MATCH' | 'COUNTDOWN' | 'IN_PROGRESS' | 'POST_ROUND' | 'POST_MATCH';

export type PlayerStatus = {
  playerId: string;
  displayName: string;
  ready: boolean;
  role: 'creator' | 'player';
  totalPoints: number;
};

// Broadcast on every phase/player-list change.
export type MatchStatus = {
  matchId: string;
  phase: MatchPhase;
  settings: MatchSettings;
  settingsLocked: boolean;
  players: PlayerStatus[];
};

export type MatchJoinedPayload = {
  role: 'creator' | 'player';
  displayName: string;
};

export type MatchCountdown = {
  secondsLeft: number;
};

// ---- Round / turn flow ---- //

// Sent to all when a round begins (words are NOT included — they are secret).
export type RoundStartPayload = {
  roundNumber: number;
  totalRounds: number;
  boardCount: BoardCount;
  turnDurationMs: number;
};

// Sent to all at the start of each turn (including turn 1).
export type TurnTickPayload = {
  turnNumber: number;
  turnDurationMs: number;
};

// ---- Guess results ---- //

// Turn 1 (starting guess): sent only to the guessing player.
// The guess is applied to every board, so results for all boards are returned.
export type StartingGuessResult = {
  boardResults: Array<{
    boardIndex: number;
    result: LetterResult[];
    solved: boolean;
    pointsEarned?: number; // present when solved
  }>;
};

// Turn 1: broadcast to all OTHER players (no letters exposed, only colour state).
export type OpponentStartingGuessUpdate = {
  playerId: string;
  boardResults: Array<{
    boardIndex: number;
    result: LetterResult[];
  }>;
};

// Turn 2+: sent only to the guessing player.
export type GuessResult = {
  boardIndex: number;
  result: LetterResult[];
  guessCount: number; // total guesses this player has now used on this board (1-MAX_GUESSES)
  solved: boolean;
  pointsEarned?: number;  // present when solved
  revealedWord?: string;  // present when player just exhausted their guesses without solving
};

// Turn 2+: broadcast to all OTHER players.
export type OpponentGuessUpdate = {
  playerId: string;
  boardIndex: number;
  result: LetterResult[];
};

// Broadcast to ALL when a player claims a board.
export type BoardClaimedUpdate = {
  boardIndex: number;
  playerId: string;
  displayName: string;
  word: string;
  guessCount: number;
  pointsEarned: number;
};

// Sent only to the submitting player when their guess is rejected.
export type GuessRejectedPayload = {
  boardIndex: number; // -1 for starting guess
  reason: 'invalid_word' | 'board_not_active' | 'no_guesses_remaining' | 'wrong_phase' | 'already_guessed_this_turn';
};

// ---- Post-round / post-match ---- //

export type BoardRoundResult = {
  boardIndex: number;
  word: string; // revealed after the round ends
  claimedBy: string | null; // playerId
  claimedByDisplayName: string | null;
  claimedAtGuessCount: number | null;
  pointsAwarded: number;
};

export type PlayerRoundResult = {
  playerId: string;
  displayName: string;
  roundPoints: number;
  totalPoints: number;
};

export type RoundResultsPayload = {
  roundNumber: number;
  boards: BoardRoundResult[];
  players: PlayerRoundResult[];
};

export type PlayerMatchResult = {
  playerId: string;
  displayName: string;
  totalPoints: number;
  rank: number; // 1-based; ties share the same rank
};

export type MatchResultsPayload = {
  players: PlayerMatchResult[];
};

// ---- Settings update (leader → server) ---- //

export type UpdateSettingsPayload = {
  boardCount?: BoardCount;
  rounds?: RoundCount;
  turnDurationSec?: TurnDurationSec;
};
