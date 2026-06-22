import { InputState } from '@cup/bouncer-shared';

type InputHandler = (input: InputState) => void;

const EMPTY_STATE: InputState = {
  move: 0,
  jumpPressed: false,
  jumpHeld: false,
  dashPressed: false,
  dashX: 0,
};

/**
 * Controls (multiple keys can drive the same action):
 *  - Move:  A / D  +  ← / →
 *  - Jump:  W  +  ↑      (grounded jump or mid-air double jump — engine decides)
 *  - Dash:  Space  +  left mouse click   (none held = stall)
 */
export class InputController {
  private disposeInput: () => void = () => {};
  private lastState: InputState = { ...EMPTY_STATE };

  onInput(scene: Phaser.Scene, handler: InputHandler) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) return this.disposeInput;
    this.disposeInput();

    const KC = Phaser.Input.Keyboard.KeyCodes;
    const aKey = keyboard.addKey(KC.A);
    const dKey = keyboard.addKey(KC.D);
    const leftArrow = keyboard.addKey(KC.LEFT);
    const rightArrow = keyboard.addKey(KC.RIGHT);
    const wKey = keyboard.addKey(KC.W);
    const upArrow = keyboard.addKey(KC.UP);
    const spaceKey = keyboard.addKey(KC.SPACE);

    const leftDown = () => aKey.isDown || leftArrow.isDown;
    const rightDown = () => dKey.isDown || rightArrow.isDown;
    const jumpDown = () => wKey.isDown || upArrow.isDown;

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

    const computeMove = (): -1 | 0 | 1 => {
      const l = leftDown();
      const r = rightDown();
      if (l && !r) return -1;
      if (r && !l) return 1;
      return 0;
    };

    // Dash direction is the left/right held at dash time (0 = stall).
    const computeDashX = (): -1 | 0 | 1 => {
      const l = leftDown();
      const r = rightDown();
      return l === r ? 0 : l ? -1 : 1;
    };

    const emitState = (jumpPressed: boolean, dashPressed = false) => {
      emitIfChanged({
        move: computeMove(),
        jumpHeld: jumpDown(),
        jumpPressed,
        dashPressed,
        dashX: dashPressed ? computeDashX() : 0,
      });
    };

    const onMove = () => emitState(false);
    const onJumpDown = () => {
      emitState(true);
      emitIfChanged({ ...EMPTY_STATE, move: computeMove(), jumpHeld: true });
    };
    const onJumpUp = () => emitState(false);
    // Dash is edge-triggered: emit the pressed state (with direction), then clear.
    const onDashDown = () => {
      emitState(false, true);
      emitIfChanged({ ...EMPTY_STATE, move: computeMove(), jumpHeld: jumpDown() });
    };
    const onPointerDown = (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) onDashDown();
    };

    aKey.on('down', onMove);
    aKey.on('up', onMove);
    dKey.on('down', onMove);
    dKey.on('up', onMove);
    leftArrow.on('down', onMove);
    leftArrow.on('up', onMove);
    rightArrow.on('down', onMove);
    rightArrow.on('up', onMove);
    wKey.on('down', onJumpDown);
    wKey.on('up', onJumpUp);
    upArrow.on('down', onJumpDown);
    upArrow.on('up', onJumpUp);
    spaceKey.on('down', onDashDown);
    scene.input.on('pointerdown', onPointerDown);

    const dispose = () => {
      aKey.off('down', onMove);
      aKey.off('up', onMove);
      dKey.off('down', onMove);
      dKey.off('up', onMove);
      leftArrow.off('down', onMove);
      leftArrow.off('up', onMove);
      rightArrow.off('down', onMove);
      rightArrow.off('up', onMove);
      wKey.off('down', onJumpDown);
      wKey.off('up', onJumpUp);
      upArrow.off('down', onJumpDown);
      upArrow.off('up', onJumpUp);
      spaceKey.off('down', onDashDown);
      scene.input.off('pointerdown', onPointerDown);
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
