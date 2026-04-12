import {
    Scene,
    Vector3,
    MeshBuilder,
    StandardMaterial,
    PBRMaterial,
    Color3,
    SceneLoader,
    ActionManager,
    ExecuteCodeAction,
    TransformNode,
    AbstractMesh,
    Mesh,
    Animation
} from '@babylonjs/core';

import '@babylonjs/loaders/glTF';

/**
 * JS parallel: Using a const object and type to replace enum due to erasableSyntaxOnly setting.
 */
export const AtomicState = {
    ORBITING: 'ORBITING',
    CONVERGING: 'CONVERGING',
    PBR_REVEAL: 'PBR_REVEAL',
    RESETTING: 'RESETTING'
} as const;

export type AtomicStateType = typeof AtomicState[keyof typeof AtomicState];

/**
 * Manages the "Atomic Helmet" interactive feature.
 */
export class AtomicHelmet {
    private scene: Scene;
    public rootNode: Mesh;
    private helmetMeshes: AbstractMesh[] = [];

    // JS parallel: Map acting as a dictionary to link original materials to their specific meshes.
    private originalMaterials: Map<AbstractMesh, any> = new Map();
    private blueprintMaterial: StandardMaterial;

    private spheres: Mesh[] = [];
    private pivots: TransformNode[] = [];
    private state: AtomicStateType = AtomicState.ORBITING;

    private baseRadius = 1.5;
    private currentRadius = 1.5;
    private orbitSpeeds: number[] = [0.02, 0.03, 0.015, 0.025, 0.035];

    private flashSphere: Mesh;
    private flashMaterial: StandardMaterial;

    constructor(scene: Scene, position: Vector3) {
        this.scene = scene;
        
        // JS parallel: Providing an invisible root mesh that acts as a bounding container. 
        // This makes it easy to select and move the entire feature in the BabylonJS Inspector.
        this.rootNode = MeshBuilder.CreateSphere("atomicHelmetRoot", { diameter: 3.5 }, scene);
        this.rootNode.isVisible = false; 
        this.rootNode.position = position;

        // Optimization: Create the blueprint material once and reuse it across all helmet sub-meshes.
        this.blueprintMaterial = new StandardMaterial("blueprintMat", scene);
        this.blueprintMaterial.diffuseColor = new Color3(0.1, 0.3, 0.8);
        this.blueprintMaterial.specularColor = new Color3(0, 0, 0);
        this.blueprintMaterial.emissiveColor = new Color3(0.05, 0.1, 0.3);
        this.blueprintMaterial.alpha = 0.6; // Transparent/Ghostly blueprint look

        // Flash mesh preparation (hidden initially)
        this.flashSphere = MeshBuilder.CreateSphere("flashSphere", { diameter: 1, segments: 16 }, scene);
        this.flashSphere.parent = this.rootNode;
        this.flashMaterial = new StandardMaterial("flashMat", scene);
        this.flashMaterial.emissiveColor = new Color3(1, 1, 1);
        this.flashMaterial.disableLighting = true; // Emissive only, ignores scene lights
        this.flashMaterial.alpha = 0;
        this.flashSphere.material = this.flashMaterial;
        this.flashSphere.scaling = Vector3.Zero();
    }

    public get position(): Vector3 {
        return this.rootNode.position;
    }

    public set position(value: Vector3) {
        this.rootNode.position = value;
    }

    public get rotation(): Vector3 {
        return this.rootNode.rotation;
    }

    public set rotation(value: Vector3) {
        this.rootNode.rotation = value;
    }

    public get scaling(): Vector3 {
        return this.rootNode.scaling;
    }

    public set scaling(value: Vector3) {
        this.rootNode.scaling = value;
    }

    public async load(): Promise<void> {
        // Load the helmet
        const result = await SceneLoader.ImportMeshAsync("", "/models/", "DamagedHelmet.glb", this.scene);

        // Fix: Parent the ENTIRE GLTF root directly to our container using .parent 
        // We use .parent instead of .setParent() here because .setParent attempts to preserve the previous
        // global coordinate by adding an inverse offset! Using .parent makes it correctly snap to the container.
        const gltfRoot = result.meshes[0];
        gltfRoot.parent = this.rootNode;

        // NOTE: We do NOT dispose gltfRoot (result.meshes[0]) because BabylonJS uses it 
        // to handle Right-handed (GLTF natively) to Left-handed coordinate conversions implicitly!

        result.meshes.forEach(mesh => {
            // Swap to blueprint material
            if (mesh.material) {
                this.originalMaterials.set(mesh, mesh.material);
                mesh.material = this.blueprintMaterial;
            }
            this.helmetMeshes.push(mesh);
        });

        this.setupInteraction();
        this.createSpheres();

        // JS parallel: Standard requestAnimationFrame loop hook.
        this.scene.onBeforeRenderObservable.add(() => this.update());
    }

    private createSpheres() {
        const createMat = (name: string, diffuse: Color3, emissive: Color3 = Color3.Black()) => {
            const mat = new StandardMaterial(name, this.scene);
            mat.diffuseColor = diffuse;
            mat.emissiveColor = emissive;
            return mat;
        };

        // 1. Albedo (Swirled color - simulating with pink/orange diffuse)
        const albedoSphere = MeshBuilder.CreateSphere("albedoSphere", { diameter: 0.15 }, this.scene);
        albedoSphere.material = createMat("albedoMat", new Color3(1, 0.4, 0.4));

        // 2. Metallic/Roughness (Highly reflective PBR)
        const metallicSphere = MeshBuilder.CreateSphere("metallicSphere", { diameter: 0.15 }, this.scene);
        const metallicMat = new PBRMaterial("metallicMat", this.scene);
        metallicMat.albedoColor = new Color3(0.8, 0.8, 0.8);
        metallicMat.metallic = 1.0;
        metallicMat.roughness = 0.05; // Very shiny
        metallicSphere.material = metallicMat;

        // 3. Normal (Purple/Blue base)
        const normalSphere = MeshBuilder.CreateSphere("normalSphere", { diameter: 0.15 }, this.scene);
        normalSphere.material = createMat("normalMat", new Color3(0.5, 0.5, 1));

        // 4. AO (White with dark crevices - simplified to light gray)
        const aoSphere = MeshBuilder.CreateSphere("aoSphere", { diameter: 0.15 }, this.scene);
        aoSphere.material = createMat("aoMat", new Color3(0.9, 0.9, 0.9));

        // 5. Emissive (Glowing)
        const emissiveSphere = MeshBuilder.CreateSphere("emissiveSphere", { diameter: 0.15 }, this.scene);
        emissiveSphere.material = createMat("emissiveMat", Color3.Black(), new Color3(0.2, 1, 0.5));

        this.spheres = [albedoSphere, metallicSphere, normalSphere, aoSphere, emissiveSphere];

        // Create distinct orbit paths by using tilted pivots
        const pivotAngles = [
            new Vector3(0, 0, Math.PI / 4),
            new Vector3(Math.PI / 3, 0, -Math.PI / 4),
            new Vector3(-Math.PI / 3, 0, Math.PI / 6),
            new Vector3(Math.PI / 2, 0, 0),
            new Vector3(-Math.PI / 2, 0, 0)
        ];

        this.spheres.forEach((sphere, i) => {
            const pivot = new TransformNode(`pivot_${i}`, this.scene);
            pivot.parent = this.rootNode;
            pivot.rotation = pivotAngles[i];
            this.pivots.push(pivot);

            sphere.parent = pivot;
            sphere.position.x = this.currentRadius;
        });
    }

    private setupInteraction() {
        this.helmetMeshes.forEach(mesh => {
            if (mesh.getTotalVertices() > 0) {
                mesh.actionManager = new ActionManager(this.scene);
                mesh.actionManager.registerAction(
                    new ExecuteCodeAction(
                        ActionManager.OnPickTrigger,
                        () => this.triggerConvergence()
                    )
                );
            }
        });
    }

    private triggerConvergence() {
        if (this.state !== AtomicState.ORBITING) return;
        this.state = AtomicState.CONVERGING;
    }

    /**
     * Optimization: This method runs per-frame. We avoid "new" keyword usage here 
     * (e.g., allocating new Vector3) to prevent garbage collection stuttering.
     */
    private update() {
        const engine = this.scene.getEngine();
        const dt = engine.getDeltaTime() / 1000;

        switch (this.state) {
            case AtomicState.ORBITING:
            case AtomicState.RESETTING:
                this.pivots.forEach((pivot, i) => {
                    pivot.rotation.y += this.orbitSpeeds[i];
                });

                if (this.state === AtomicState.RESETTING) {
                    this.currentRadius += dt * 2.0; // Expansion speed
                    if (this.currentRadius >= this.baseRadius) {
                        this.currentRadius = this.baseRadius;
                        this.state = AtomicState.ORBITING;
                    }
                    this.updateSphereRadius();
                }
                break;

            case AtomicState.CONVERGING:
                // Speed up orbit for dramatic wind-up effect
                this.pivots.forEach((pivot, i) => {
                    pivot.rotation.y += this.orbitSpeeds[i] * 5;
                });

                this.currentRadius -= dt * 3.0; // Convergence speed

                if (this.currentRadius <= 0) {
                    this.currentRadius = 0;
                    this.triggerFlashAndReveal();
                }
                this.updateSphereRadius();
                break;

            case AtomicState.PBR_REVEAL:
                // Helmet is fully rendered, spheres are hidden, do nothing.
                break;
        }
    }

    private updateSphereRadius() {
        // Optimization: Modifying existing properties instead of creating new instances.
        this.spheres.forEach(sphere => {
            sphere.position.x = this.currentRadius;
        });
    }

    private triggerFlashAndReveal() {
        this.state = AtomicState.PBR_REVEAL;

        // Hide spheres upon impact
        this.spheres.forEach(s => s.isVisible = false);

        // Play flash animation
        this.flashSphere.scaling.setAll(0.1);
        this.flashMaterial.alpha = 1;

        const frameRate = 60;
        const flashAnim = new Animation("flashEase", "scaling", frameRate, Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT);
        const keys = [
            { frame: 0, value: new Vector3(0.1, 0.1, 0.1) },
            { frame: 5, value: new Vector3(3, 3, 3) }, // Rapid expand
            { frame: 15, value: new Vector3(4, 4, 4) }
        ];
        flashAnim.setKeys(keys);

        const fadeAnim = new Animation("fadeEase", "material.alpha", frameRate, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT);
        const fadeKeys = [
            { frame: 0, value: 1 },
            { frame: 5, value: 1 },
            { frame: 15, value: 0 } // Fade out quickly
        ];
        fadeAnim.setKeys(fadeKeys);

        this.flashSphere.animations = [flashAnim, fadeAnim];
        this.scene.beginAnimation(this.flashSphere, 0, 15, false);

        // IMMEDIATE SNAP to PBR implementation
        this.helmetMeshes.forEach(mesh => {
            if (this.originalMaterials.has(mesh)) {
                mesh.material = this.originalMaterials.get(mesh);
            }
        });

        // JS parallel: Standard setTimeout to queue a reset after 5 seconds
        setTimeout(() => this.triggerReset(), 10000);
    }

    private triggerReset() {
        if (this.state !== AtomicState.PBR_REVEAL) return;

        // Snap back to blueprint
        this.helmetMeshes.forEach(mesh => {
            if (this.originalMaterials.has(mesh)) {
                mesh.material = this.blueprintMaterial;
            }
        });

        // Re-show spheres and let the update loop handle expansion via RESETTING state
        this.spheres.forEach(s => s.isVisible = true);
        this.state = AtomicState.RESETTING;
    }
}
