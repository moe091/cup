import { PolygonDef } from '@cup/bouncer-shared';
import EditorTool, { ToolName } from './EditorTool';
import type { LevelEditorScene } from './LevelEditor';

export default class PolygonTool implements EditorTool {
  name: ToolName = 'polygon';
  private scene?: LevelEditorScene;
  private vertices: Array<{ x: number; y: number }> = [];
  private vertexCircles: Phaser.GameObjects.Arc[] = [];
  private previewLines?: Phaser.GameObjects.Graphics;
  private previewFill?: Phaser.GameObjects.Graphics;
  private ghostLine?: Phaser.GameObjects.Graphics;
  private enabled = false;

  private onPointerDown = (pointer: Phaser.Input.Pointer) => {
    if (!this.scene || !this.scene.isPrimaryToolPointer(pointer)) return;
    if (this.scene.isPointerOverToolbar(pointer)) return;

    const pos = this.getPosition(pointer);
    this.addVertex(pos.x, pos.y);
  };

  private onPointerMove = (pointer: Phaser.Input.Pointer) => {
    if (!this.scene || this.vertices.length === 0) return;

    this.updateGhostLine(pointer);
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.scene) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.finalizePoly();
    } else if (event.key === 'Escape') {
      this.cancelPoly();
    }
  };

  private getPosition(pointer: Phaser.Input.Pointer) {
    if (pointer.event?.shiftKey && this.scene) {
      return this.scene.snapWorld(pointer.worldX, pointer.worldY);
    }
    return { x: pointer.worldX, y: pointer.worldY };
  }

  private addVertex(x: number, y: number) {
    if (!this.scene) return;

    this.vertices.push({ x, y });

    // Draw vertex circle
    const circle = this.scene.add.circle(x, y, 4, 0x4a90e2);
    circle.setDepth(10);
    this.vertexCircles.push(circle);

    this.updatePreview();
  }

  private updatePreview() {
    if (!this.scene || this.vertices.length < 2) return;

    // Clean up old preview
    this.previewLines?.destroy();
    this.previewFill?.destroy();

    // Draw lines connecting vertices
    this.previewLines = this.scene.add.graphics();
    this.previewLines.lineStyle(2, 0x4a90e2);
    this.previewLines.setDepth(5);

    for (let i = 0; i < this.vertices.length - 1; i++) {
      this.previewLines.lineBetween(
        this.vertices[i].x,
        this.vertices[i].y,
        this.vertices[i + 1].x,
        this.vertices[i + 1].y,
      );
    }

    // Draw fill if we have 3+ vertices
    if (this.vertices.length >= 3) {
      this.previewFill = this.scene.add.graphics();
      this.previewFill.fillStyle(0x4a90e2, 0.3);
      this.previewFill.setDepth(4);

      this.previewFill.beginPath();
      this.previewFill.moveTo(this.vertices[0].x, this.vertices[0].y);
      for (let i = 1; i < this.vertices.length; i++) {
        this.previewFill.lineTo(this.vertices[i].x, this.vertices[i].y);
      }
      this.previewFill.closePath();
      this.previewFill.fillPath();
    }
  }

  private updateGhostLine(pointer: Phaser.Input.Pointer) {
    if (!this.scene || this.vertices.length === 0) return;

    this.ghostLine?.destroy();
    this.ghostLine = this.scene.add.graphics();
    this.ghostLine.lineStyle(1, 0x4a90e2, 0.5);
    this.ghostLine.setDepth(9);

    const lastVertex = this.vertices[this.vertices.length - 1];
    const pos = this.getPosition(pointer);

    // Line from last vertex to cursor
    this.ghostLine.lineBetween(lastVertex.x, lastVertex.y, pos.x, pos.y);

    // If we have 2+ vertices, also show closing line
    if (this.vertices.length >= 2) {
      this.ghostLine.lineBetween(pos.x, pos.y, this.vertices[0].x, this.vertices[0].y);
    }
  }

  private finalizePoly() {
    if (!this.scene || this.vertices.length < 3) {
      // Need at least 3 vertices for a polygon
      return;
    }

    const polygon: PolygonDef = {
      type: 'polygon',
      name: `polygon_${Date.now()}`,
      vertices: [...this.vertices],
    };

    this.scene.addObject(polygon);
    this.cleanup();
  }

  private cancelPoly() {
    this.cleanup();
  }

  private cleanup() {
    this.vertices = [];
    this.vertexCircles.forEach((c) => c.destroy());
    this.vertexCircles = [];
    this.previewLines?.destroy();
    this.previewLines = undefined;
    this.previewFill?.destroy();
    this.previewFill = undefined;
    this.ghostLine?.destroy();
    this.ghostLine = undefined;
  }

  enable(scene: LevelEditorScene) {
    if (this.enabled) return;
    this.enabled = true;
    this.scene = scene;
    scene.input.on('pointerdown', this.onPointerDown);
    scene.input.on('pointermove', this.onPointerMove);
    scene.input.keyboard?.on('keydown', this.onKeyDown);
  }

  disable() {
    if (!this.scene || !this.enabled) return;
    this.scene.input.off('pointerdown', this.onPointerDown);
    this.scene.input.off('pointermove', this.onPointerMove);
    this.scene.input.keyboard?.off('keydown', this.onKeyDown);
    this.enabled = false;
    this.cleanup();
    this.scene = undefined;
  }
}
