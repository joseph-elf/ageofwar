import Phaser from 'phaser';
import { ART, buildAllArt } from '../art';

/** Generates every texture procedurally, then tells the shell it is ready. No image files are loaded. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  create(): void {
    buildAllArt();
    ART.forEach((canvas, key) => {
      if (!this.textures.exists(key)) this.textures.addCanvas(key, canvas);
    });
    this.game.events.emit('booted');
  }
}
