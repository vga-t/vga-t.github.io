import './style.css';
import { SceneManager } from './SceneManager';
import { DioramaHub } from './DioramaHub';
import { LoadingScreen } from './modules/LoadingScreen';

// JS parallel: Instantiate UI loading manager to handle pre-rendering loading state.
const loadingScreen = new LoadingScreen();

// High-level application setup
const sceneManager = new SceneManager('renderCanvas');
const dioramaHub = new DioramaHub(sceneManager.scene);

// Asynchronously build diorama assets while updating loading screen progress
dioramaHub.build((progress) => {
    loadingScreen.updateProgress(progress);
}).then(async () => {
    // JS parallel: Ensure scene shaders and GPU resources are ready before revealing canvas
    await sceneManager.scene.whenReadyAsync();
    sceneManager.scene.freezeActiveMeshes();

    // Start 3D render loop
    sceneManager.startRenderLoop();

    // Smoothly transition away loading screen
    await loadingScreen.hide();
});
