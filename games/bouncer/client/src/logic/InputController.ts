import { InputVector } from "@cup/bouncer-shared";
type PointerHandler = (inputVector: InputVector) => void;

export class InputController {
    private isPointerDown = false;
    private downX = -1;
    private downY = -1;
    private dragThreshold = 30;
    private disposeDrag: () => void = () => {};

    onDrag(scene: Phaser.Scene, dragHandler: PointerHandler, releaseHandler: PointerHandler, cancelHandler: () => void) {
        const input = scene.input;
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
                releaseHandler({x: dx, y: dy});
            else
                cancelHandler();
        };
        input.on('pointerup', pointerUp);


        // ----- Draw UI Arrow on mouse move ----- \\
        const pointerMove = (pointer: Phaser.Input.Pointer) => {
            if (!this.isPointerDown) return;

            const dx = pointer.x - this.downX;
            const dy = pointer.y - this.downY;

            dragHandler({x: dx, y: dy});
        };
        input.on('pointermove', pointerMove);

        const cancelDrag = () => {
            this.isPointerDown = false;
            cancelHandler();
        }
        input.on('gameout', cancelDrag);

        // ------- Make sure listeners don't leak ------- \\
        const dispose = () => {
            input.off('pointerdown', pointerDown);
            input.off('pointerup', pointerUp);
            input.off('pointermove', pointerMove);
            input.off('gameout', cancelDrag);
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