import type { InputState } from '@cup/bouncer-shared';

const DEFAULT_INPUT: InputState = { move: 0, jumpPressed: false, jumpHeld: false };

export class InputSampler {
  private current: InputState = { ...DEFAULT_INPUT };

  updateFromEvent(input: InputState) {
    this.current = {
      move: input.move,
      jumpHeld: input.jumpHeld,
      jumpPressed: this.current.jumpPressed || input.jumpPressed,
    };
  }

  consumeTickInput(): InputState {
    const snapshot = { ...this.current };
    this.current.jumpPressed = false;
    return snapshot;
  }

  getCurrent(): InputState {
    return { ...this.current };
  }

  reset() {
    this.current = { ...DEFAULT_INPUT };
  }
}
