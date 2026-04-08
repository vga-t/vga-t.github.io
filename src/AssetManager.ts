import { SceneLoader, Scene, Vector3, AbstractMesh, ShadowGenerator } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

/**
 * Manages external asset loading for the scene.
 * JS parallel: This is a specialized module for side-effect heavy operations (loading).
 */
export class AssetManager {
    /**
     * Loads the CUSAT building model.
     */
    public static async loadCusatBuilding(scene: Scene, shadowGenerator?: ShadowGenerator): Promise<void> {
        try {
            const result = await SceneLoader.ImportMeshAsync("", "/models/", "cusat-final.glb", scene);
            const root = result.meshes[0];
            root.scaling = new Vector3(10, 10, 10);
            root.position = new Vector3(-10, 1.5, 0);

            if (shadowGenerator) {
                result.meshes.forEach((mesh: AbstractMesh) => {
                    shadowGenerator.addShadowCaster(mesh);
                    mesh.receiveShadows = true;
                });
            }
        } catch (error) {
            console.error("Failed to load CUSAT building:", error);
        }
    }

    /**
     * Loads the Uni Rostock building model.
     */
    public static async loadRostockBuilding(scene: Scene, shadowGenerator?: ShadowGenerator): Promise<void> {
        try {
            const result = await SceneLoader.ImportMeshAsync("", "/models/", "uniRostock.glb", scene);
            const root = result.meshes[0];

            // Positioning Rostock on the opposite side
            root.scaling = new Vector3(8, 8, 8); // Assuming similar scale needs
            root.position = new Vector3(10, 2, 0);

            if (shadowGenerator) {
                result.meshes.forEach((mesh: AbstractMesh) => {
                    shadowGenerator.addShadowCaster(mesh);
                    mesh.receiveShadows = true;
                });
            }
        } catch (error) {
            console.error("Failed to load Uni Rostock building:", error);
        }
    }
}
