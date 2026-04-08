import {
    Scene,
    Vector3,
    HemisphericLight,
    DirectionalLight,
    ShadowGenerator,
    MeshBuilder,
    PBRMaterial,
    Color3,
    ArcRotateCamera,
    // DefaultRenderingPipeline,
    // SSAO2RenderingPipeline,
    HDRCubeTexture
} from '@babylonjs/core';
import '@babylonjs/core/Materials/Textures/Loaders/ddsTextureLoader';
import '@babylonjs/core/Materials/Textures/Loaders/envTextureLoader';
import '@babylonjs/core/Helpers/sceneHelpers';
import { ProceduralFence } from './ProceduralFence';
import { AssetManager } from './AssetManager';

/**
 * Manages the contents and environment of the 3D diorama.
 * JS parallel: Abstracting scene composition into its own component.
 */
export class DioramaHub {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    public build(): void {
        this.setupEnvironment();
        this.setupLighting();
        this.setupGeometry();
        this.setupCamera();
        // this.setupPostProcessingAndFog();

        // Load the building models
        const shadowGenerator = (this.scene as any).metadata.shadowGenerator as ShadowGenerator;
        AssetManager.loadCusatBuilding(this.scene, shadowGenerator);
        AssetManager.loadRostockBuilding(this.scene, shadowGenerator);
    }

    private setupEnvironment(): void {
        // Load the custom HDR file. 
        // Note: The file was moved to /public/sky.hdr so Vite serves it statically
        const hdrTexture = new HDRCubeTexture("/sky.hdr", this.scene, 512);

        // The visual skybox using the HDR texture
        const skybox = this.scene.createDefaultSkybox(hdrTexture, true, 1000, 0.5); // 0.5 is an optional blur

        // Environment texture for Image Based Lighting on PBR Materials
        this.scene.environmentTexture = hdrTexture;
        this.scene.environmentIntensity = 1.0;

        // Ensure skybox doesn't get hidden by fog (fog is disabled anyway, but good measure)
        if (skybox) {
            skybox.infiniteDistance = true;
        }
    }

    private setupLighting(): void {
        // Ambient soft fill
        const ambientLight = new HemisphericLight("ambientLight", new Vector3(0, 1, 0), this.scene);
        ambientLight.intensity = 0.4;

        // Key light
        const keyLight = new DirectionalLight("keyLight", new Vector3(1, -1, 1), this.scene);
        keyLight.intensity = 1.0;

        // Shadows
        const shadowGenerator = new ShadowGenerator(1024, keyLight);
        shadowGenerator.useBlurExponentialShadowMap = true;
        shadowGenerator.blurKernel = 32;

        (this.scene as any).metadata = this.scene.metadata || {};
        (this.scene as any).metadata.shadowGenerator = shadowGenerator;
    }

    private setupGeometry(): void {
        const shadowGenerator = (this.scene as any).metadata.shadowGenerator as ShadowGenerator;

        // The Slab: 30x0.2x30 base at Y = -0.1
        const slab = MeshBuilder.CreateBox("slab", { width: 30, height: 0.2, depth: 30 }, this.scene);
        slab.position.y = -0.1;
        slab.receiveShadows = true;

        const slabMat = new PBRMaterial("slabMat", this.scene);
        slabMat.albedoColor = Color3.FromHexString("#f0f0f0");
        slabMat.roughness = 0.6;
        slabMat.metallic = 0.1;
        slab.material = slabMat;

        // Optimization: Freeze matrix for static root 
        slab.freezeWorldMatrix();

        if (shadowGenerator) shadowGenerator.addShadowCaster(slab);

        // Build procedural perimeter fences instead of glass panes
        ProceduralFence.build(this.scene, 30, 30);
    }

    private setupCamera(): void {
        const camera = new ArcRotateCamera("camera", Math.PI / 4, Math.PI / 3, 30, Vector3.Zero(), this.scene);

        // Ensure the camera can see out to the massive skybox
        camera.maxZ = 20000;
        // Enforce user viewing limits to focus on the 30x30 Diorama
        camera.lowerBetaLimit = 0.2;
        camera.upperBetaLimit = 1.45; // Do not look completely underneath
        camera.lowerRadiusLimit = 10;
        camera.upperRadiusLimit = 45;

        // Disable panning completely
        camera.panningSensibility = 0;

        // Attach user control
        camera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
    }

    // private setupPostProcessingAndFog(): void {
    //     // Disabled Fog because it completely hides the skybox texture
    //     this.scene.fogMode = Scene.FOGMODE_NONE;

    //     const activeCamera = this.scene.activeCamera;
    //     if (!activeCamera) return;

    //     // Cinematic Post-processing
    //     const defaultPipeline = new DefaultRenderingPipeline("defaultPipeline", true, this.scene, [activeCamera]);
    //     defaultPipeline.samples = 4; // MSAA for smooth edges
    //     defaultPipeline.fxaaEnabled = true; // FXAA for fine details like fences

    //     // Bloom setup
    //     defaultPipeline.bloomEnabled = true;
    //     defaultPipeline.bloomThreshold = 0.1; // very low 
    //     defaultPipeline.bloomWeight = 0.3;

    //     // Ambient Occlusion (Contact Shadows)
    //     const ssao = new SSAO2RenderingPipeline("ssao", this.scene, 0.75, [activeCamera]);
    //     ssao.radius = 2;
    //     ssao.totalStrength = 1.0;
    //     ssao.base = 0.5;
    // }
}
