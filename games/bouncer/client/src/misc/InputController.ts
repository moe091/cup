import { InputState } from '@cup/bouncer-shared';

type InputHandler = (input: InputState) => void;

const EMPTY_STATE: InputState = {
  move: 0,
  jumpPressed: false,
  jumpHeld: false,
  dashPressed: false,
  dashX: 0,
};

export class InputController {
  private disposeInput: () => void = () => {};
  private lastState: InputState = { ...EMPTY_STATE };

  onInput(scene: Phaser.Scene, handler: InputHandler) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) return this.disposeInput;
    this.disposeInput();

    const left = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    const right = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    const jump = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    const dash = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    const emitIfChanged = (next: InputState) => {
      const changed =
        next.move !== this.lastState.move ||
        next.jumpHeld !== this.lastState.jumpHeld ||
        next.jumpPressed !== this.lastState.jumpPressed ||
        next.dashPressed !== this.lastState.dashPressed;
      if (!changed) return;
      this.lastState = next;
      handler(next);
    };

    const computeMove = () => {
      if (left.isDown && !right.isDown) return -1 as const;
      if (right.isDown && !left.isDown) return 1 as const;
      return 0 as const;
    };

    // Dash direction is the A/D held at dash time (0 = stall). Read only on dash.
    const computeDashX = (): -1 | 0 | 1 => (left.isDown === right.isDown ? 0 : left.isDown ? -1 : 1);

    const emitState = (jumpPressed: boolean, dashPressed = false) => {
      emitIfChanged({
        move: computeMove(),
        jumpHeld: jump.isDown,
        jumpPressed,
        dashPressed,
        dashX: dashPressed ? computeDashX() : 0,
      });
    };

    const onLeftDown = () => emitState(false);
    const onLeftUp = () => emitState(false);
    const onRightDown = () => emitState(false);
    const onRightUp = () => emitState(false);
    // Space: grounded jump or mid-air double jump (engine decides). Edge-triggered.
    const onJumpDown = () => {
      emitState(true);
      emitIfChanged({ ...EMPTY_STATE, move: computeMove(), jumpHeld: true });
    };
    const onJumpUp = () => emitState(false);
    // Shift: mid-air dash in the A/D direction (none = stall). Edge-triggered.
    const onDashDown = () => {
      emitState(false, true);
      emitIfChanged({ ...EMPTY_STATE, move: computeMove(), jumpHeld: jump.isDown });
    };

    left.on('down', onLeftDown);
    left.on('up', onLeftUp);
    right.on('down', onRightDown);
    right.on('up', onRightUp);
    jump.on('down', onJumpDown);
    jump.on('up', onJumpUp);
    dash.on('down', onDashDown);

    const dispose = () => {
      left.off('down', onLeftDown);
      left.off('up', onLeftUp);
      right.off('down', onRightDown);
      right.off('up', onRightUp);
      jump.off('down', onJumpDown);
      jump.off('up', onJumpUp);
      dash.off('down', onDashDown);
      this.disposeInput = () => {};
      this.lastState = { ...EMPTY_STATE };
    };

    this.disposeInput = dispose;
    return dispose;
  }

  dispose() {
    this.disposeInput();
  }
}
