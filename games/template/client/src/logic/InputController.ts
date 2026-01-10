import { InputVector } from "@cup/bouncer-shared";
type PointerHandler = (inputVector: InputVector) => void;

export class InputController {
    private isPointerDown = false;
    private downX = -1;
    private downY = -1;
    private dragThreshold = 30;
    private disposeDrag: () => void = () => {};

    onDrag(input: Phaser.Input.InputPlugin, handler: PointerHandler) {
        this.disposeDrag(); // only want 1 drag handler, avoid leaking or stacking

        // --------- Track Pointer Down ----------- \\
        const pointerDown = (pointer: Phaser.Input.Pointer) => {
            this.isPointerDown = true;
            this.downX = pointer.x;
            this.downY = pointer.y
        };
        input.on('pointerdown', pointerDown);
        
        // ----- Calculate Drag on Pointer Up ----- \\
        const pointerUp = (pointer: Phaser.Input.Pointer) => {
            if (!this.isPointerDown) return; //this kinda doesn't do anything but I'll keep it just incase

            this.isPointerDown = false;
            const dx = pointer.x - this.downX;
            const dy = pointer.y - this.downY;

            if (Math.hypot(dx, dy) > this.dragThreshold) 
                handler({x: dx, y: dy});
        };
        input.on('pointerup', pointerUp);

        // ------- Make sure listeners don't leak ------- \\
        const dispose = () => {
            input.off('pointerdown', pointerDown)
            input.off('pointerup', pointerUp);
            this.isPointerDown = false;
            this.disposeDrag = () => {};
        }

        this.disposeDrag = dispose;
        return dispose;
    }


    dispose() {
        this.disposeDrag();
    }

}   