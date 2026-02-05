import './style.css';
import { SceneManager } from './SceneManager';
import { DioramaHub } from './DioramaHub';


// High-level application setup
const sceneManager = new SceneManager('renderCanvas');
const dioramaHub = new DioramaHub(sceneManager.scene);

// Build feature elements
dioramaHub.build();


sceneManager.scene.freezeActiveMeshes();


// Start lifecycle
sceneManager.startRenderLoop();
