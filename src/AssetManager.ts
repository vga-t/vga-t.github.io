import { SceneLoader } from '@babylonjs/core';
import type { Scene, AbstractMesh } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type { ModelTransform } from './types';

/**
 * Manages external asset loading for the scene.
 * JS parallel: This is a specialized module for side-effect heavy operations (loading).
 */
export class AssetManager {
    /**
     * Loads a 3D model from the /models/ directory and sets its transform.
     * 
     * @param scene The BabylonJS scene
     * @param options The configuration for loading and transforming the model
     */
    public static async loadModel(
        scene: Scene,
        options: ModelTransform
    ): Promise<void> {
        const { 
            fileName, 
            shadowGenerator,
            animate
        } = options;
        
        try {
            const result = await SceneLoader.ImportMeshAsync("", "/models/", fileName, scene);
            const root = result.meshes[0];
            
            // Apply standard transforms to the root node
            this.applyTransform(root, options);

            // Play animations if requested and available
            // JS parallel: Start all animation groups to loop by default.
            if (animate && result.animationGroups.length > 0) {
                result.animationGroups.forEach(group => group.play(true));
            } else {
                // Optimization: Freeze matrix for static root to avoid per-frame calculations.
                // We only do this for non-animated models to ensure performance.
                root.freezeWorldMatrix();
            }

            if (shadowGenerator) {
                result.meshes.forEach((mesh: AbstractMesh) => {
                    // Only add actual visible geometry to shadows to prevent helper nodes 
                    // (like empty cameras/lights in the GLB) from causing artifacts.
                    if (mesh.isVisible && mesh.getTotalVertices() > 0) {
                        shadowGenerator.addShadowCaster(mesh);
                        mesh.receiveShadows = true;
                    }
                });
            }
        } catch (error) {
            console.error(`Failed to load model ${fileName}:`, error);
        }
    }

    /**
     * Applies position, rotation, and scaling to a mesh.
     * JS parallel: A utility function to avoid repeating transform logic.
     * 
     * @param mesh The mesh to transform
     * @param transform The transformation parameters
     */
    public static applyTransform(mesh: AbstractMesh, transform: Partial<ModelTransform>): void {
        if (transform.position) mesh.position = transform.position.clone();
        
        if (transform.rotation) {
            // Clearing rotationQuaternion ensures property 'rotation' is used
            mesh.rotationQuaternion = null;
            mesh.rotation = transform.rotation.clone();
        }
        
        if (transform.scaling) mesh.scaling = transform.scaling.clone();
    }
}
