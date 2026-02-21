import { InputState } from '@cup/bouncer-shared';

type InputHandler = (input: InputState) => void;

export class InputController {
  private disposeInput: () => void = () => {};
  private lastState: InputState = { move: 0, jumpPressed: false, jumpHeld: false };

  onInput(scene: Phaser.Scene, handler: InputHandler) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) return this.disposeInput;
    this.disposeInput();

    const left = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    const right = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    const jump = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    const emitIfChanged = (next: InputState) => {
      const changed =
        next.move !== this.lastState.move ||
        next.jumpHeld !== this.lastState.jumpHeld ||
        next.jumpPressed !== this.lastState.jumpPressed;
      if (!changed) return;
      this.lastState = next;
      handler(next);
    };

    const computeMove = () => {
      if (left.isDown && !right.isDown) return -1 as const;
      if (right.isDown && !left.isDown) return 1 as const;
      return 0 as const;
    };

    const emitState = (jumpPressed: boolean) => {
      emitIfChanged({
        move: computeMove(),
        jumpHeld: jump.isDown,
        jumpPressed,
      });
    };

    const onLeftDown = () => emitState(false);
    const onLeftUp = () => emitState(false);
    const onRightDown = () => emitState(false);
    const onRightUp = () => emitState(false);
    const onJumpDown = () => {
      console.log('[Bouncer.Input] jumpPressed');
      emitState(true);
      emitIfChanged({
        move: computeMove(),
        jumpHeld: true,
        jumpPressed: false,
      });
    };
    const onJumpUp = () => emitState(false);

    left.on('down', onLeftDown);
    left.on('up', onLeftUp);
    right.on('down', onRightDown);
    right.on('up', onRightUp);
    jump.on('down', onJumpDown);
    jump.on('up', onJumpUp);

    const dispose = () => {
      left.off('down', onLeftDown);
      left.off('up', onLeftUp);
      right.off('down', onRightDown);
      right.off('up', onRightUp);
      jump.off('down', onJumpDown);
      jump.off('up', onJumpUp);
      this.disposeInput = () => {};
      this.lastState = { move: 0, jumpPressed: false, jumpHeld: false };
    };

    this.disposeInput = dispose;
    return dispose;
  }

  dispose() {
    this.disposeInput();
  }
}
