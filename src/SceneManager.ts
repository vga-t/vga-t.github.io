import { Engine, Scene, Color4 } from '@babylonjs/core';

/**
 * Manages the core Babylon.js Engine and Scene lifecycle.
 * JS parallel: Acts like an IIFE/module that sets up and returns the main rendering context.
 */
export class SceneManager {
    public canvas: HTMLCanvasElement;
    public engine: Engine;
    public scene: Scene;

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        
        // Initialize engine with anti-aliasing
        this.engine = new Engine(this.canvas, true, { preserveDrawingBuffer: true, stencil: true });
        this.scene = new Scene(this.engine);
        
        // Match dark background
        this.scene.clearColor = new Color4(0.02, 0.02, 0.02, 1);

        this.setupResize();
    }

    /**
     * Handle window resize event smoothly.
     */
    private setupResize(): void {
        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    }

    /**
     * Run the engine render loop.
     */
    public startRenderLoop(): void {
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
    }
}
