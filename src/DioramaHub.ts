import * as BABYLON from '@babylonjs/core';
import {
    Scene,
    Vector3,
    HemisphericLight,
    DirectionalLight,
    ShadowGenerator,
    // MeshBuilder,
    // PBRMaterial,
    Color3,
    // UniversalCamera,
    ArcRotateCamera,
    // DefaultRenderingPipeline,
    // SSAO2RenderingPipeline,
    HDRCubeTexture
} from '@babylonjs/core';
import '@babylonjs/core/Materials/Textures/Loaders/ddsTextureLoader';
import '@babylonjs/core/Materials/Textures/Loaders/envTextureLoader';
import '@babylonjs/core/Helpers/sceneHelpers';
import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';
// import { ProceduralFence } from './ProceduralFence';
import { AssetManager } from './AssetManager';
import { AtomicHelmet } from './AtomicHelmet';
import { ImmersiveWormplots } from './ImmersiveWormplots';
import { DataWallHeatmap } from './DataWallHeatmap';

/**
 * Manages the contents and environment of the 3D diorama.
 * JS parallel: Abstracting scene composition into its own component.
 */
export class DioramaHub {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
        // JS parallel: Required for Babylon Inspector to function correctly in modular environments.
        (window as any).BABYLON = BABYLON;
    }

    public build(): void {
        this.setupEnvironment();
        this.setupLighting();
        this.setupFog();
        this.setupGeometry();
        this.setupCamera();
        this.setupDebugLayer();
        // this.setupPostProcessingAndFog();
        const shadowGenerator = (this.scene as any).metadata.shadowGenerator as ShadowGenerator;
        const DEG2RAD = Math.PI / 180;

        // 1. Load the Floating Island (The new base)
        AssetManager.loadModel(this.scene, {
            fileName: "floating_island_1k.glb",
            position: new Vector3(0, 0, 0),
            scaling: new Vector3(0.25, 0.25, 0.25),
            shadowGenerator
        });

        // 2. Load the CUSAT Building (Left side of island)
        AssetManager.loadModel(this.scene, {
            fileName: "cusat-final.glb",
            position: new Vector3(17.82, 5.79, -8.73),
            rotation: new Vector3(0, -19, 0), // Rotated 45 degrees
            scaling: new Vector3(6.0, 6.0, 6.0),
            shadowGenerator,
            annotations: {
                lines: ["B.tech in Electronics and Communication Engineering", "Cochin University of Science and Technology", "2016-2020"],
                color: "#f0a400ff",
                size: 15,
                fontWeight: "bold"
            }
        });

        // 3. Load the Rostock Building (Right side of island)
        AssetManager.loadModel(this.scene, {
            fileName: "uniRostock.glb",
            position: new Vector3(-9.57, 5.94, -3.24),
            rotation: new Vector3(0, 131, 0), // Rotated -30 degrees
            scaling: new Vector3(7.1, 8.6, 7.1),
            shadowGenerator,
            annotations: {
                lines: ["MS in Visual Computing", "University of Rostock", "2022-2025"],
                color: "#885717ff",
                size: 15,
                fontWeight: "bold",
            }
        });

        AssetManager.loadModel(this.scene, {
            fileName: "reactor.glb",
            position: new Vector3(19.09, 7.48, -1.72),
            rotation: new Vector3(0, 114, 0), // Rotated -30 degrees
            scaling: new Vector3(5.3, 5.3, 5.3),
            shadowGenerator,
            annotations: {
                lines: ["Research intern", "Bhabha Atomic Reserach Center"],
                color: "#8f9294ff",
                size: 15,
                fontWeight: "bold"
            }
        });


        AssetManager.loadModel(this.scene, {
            fileName: "german_post_box.glb",
            position: new Vector3(-17.67, 2.98, 4.82),
            rotation: new Vector3(0, 13 * DEG2RAD, 0), // Rotated -30 degrees
            scaling: new Vector3(0.05, 0.05, 0.05),
            clickUrl: "mailto:vipingabraham@yahoo.com",
            shadowGenerator,
            annotations: {
                lines: ["Contact Me"],
                color: "#dbc500ff",
                worldOffset: [0.361, 3.425, -0.086],
                size: 15,
                fontWeight: "bold"
            }
        });

        // 5. Load the Animated Github Kitten
        AssetManager.loadModel(this.scene, {
            fileName: "github-kitten/source/gitkit_final.glb",
            position: new Vector3(-14.46, 3.09, 6.68),
            rotation: new Vector3(4 * DEG2RAD, 143 * DEG2RAD, -0 * DEG2RAD),
            scaling: new Vector3(2.5, 2.5, 2.5),
            animate: true,
            clickUrl: "https://github.com/vga-t",
            shadowGenerator,
            annotations: {
                lines: ["GitHub", "@vga-t"],
                color: "#000000ff",
                size: 15,
                fontWeight: "bold"
            }
        });

        AssetManager.loadModel(this.scene, {
            fileName: "linkedin.glb",
            position: new Vector3(-11.97, 4.69, 9.70),
            rotation: new Vector3(84 * DEG2RAD, 136 * DEG2RAD, 161 * DEG2RAD),
            scaling: new Vector3(-1.0, -1.0, 1.0),
            coordinateSystem: "right-handed",
            clickUrl: "https://www.linkedin.com/in/vipingabraham",
            shadowGenerator,
            annotations: {
                lines: ["LinkedIn"],
                color: "#5DADE2",
                size: 15,
                fontWeight: "bold",
                worldOffset: [0.093, 2.563, -0.203],
            }
        });

        // 6. Load the Atomic Helmet interaction feature
        // Positioned centrally above the floating island plateau
        const atomicHelmet = new AtomicHelmet(this.scene, new Vector3(0, 5.5, 0), {
            lines: ["Project", "PBR Renderer"],
            color: "#1345ebff",
            size: 15,
            fontWeight: "bold"
        });

        atomicHelmet.load();
        atomicHelmet.position = new Vector3(-2.81, 6.00, -0.44);
        atomicHelmet.rotation = new Vector3(0, 112 * DEG2RAD, 0);
        atomicHelmet.scaling = new Vector3(1.5, 1.5, 1.5);

        // 7. Load the Immersive Wormplots visualization feature
        // JS parallel: Initialize the self-contained component anywhere in the scene graph.
        // Positioned high above the island for clear visibility.
        new ImmersiveWormplots(this.scene, new Vector3(1.08, 5.48, 3.37), new Vector3(0, 39 * DEG2RAD, 0), {
            masterScale: 0.2, // Slightly enlarged for initial visibility
            clickUrl: "https://vga-t.github.io/Immersive-Wormplots-in-VR/",
            annotations: {
                lines: ["Project", "Immersive Wormplot Visualization in VR"],
                color: "#e000e7ff",
                size: 15,
                fontWeight: "bold",
                worldOffset: [-0.919, 2.950, 0.000]
            }
        });

        // 8. Load the Data Wall Heatmap
        // Positioned near the back to act as a billboard display.
        new DataWallHeatmap(
            this.scene,
            new Vector3(1.96, 6.51, -7.56), // Elevated and positioned slightly off-center
            new Vector3(0, 138 * DEG2RAD, 0), // Rotated slightly to face the main viewing area
            new Vector3(1, 1, 1),
            {
                displayWidth: 8,
                displayHeight: 4,
                rows: 30,
                columns: 15,
                clickUrl: "https://tabularwall.vercel.app/",
                annotations: {
                    lines: ["Master thesis", "AI-assisted Interactive Visualization on Large Curved Virtual Display Surfaces"],
                    color: "#36ac54ff",
                    size: 15,
                    fontWeight: "bold"
                }
            }
        );
    }

    private setupEnvironment(): void {
        // Load the custom HDR file. 
        // Note: The file was moved to /public/sky.hdr so Vite serves it statically
        const hdrTexture = new HDRCubeTexture("/sky.hdr", this.scene, 512);

        // Increase skybox size and use a slight blur
        const skybox = this.scene.createDefaultSkybox(hdrTexture, true, 500, 0.1);

        // Optimization: Disable ground projection which often causes "holes" or patches in the lower hemisphere
        if (skybox && skybox.material && (skybox.material as any).enableGroundProjection !== undefined) {
            (skybox.material as any).enableGroundProjection = false;
        }

        // Environment texture for Image Based Lighting on PBR Materials
        this.scene.environmentTexture = hdrTexture;
        this.scene.environmentIntensity = 1.79;

        // Ensure skybox doesn't get hidden by depth testing
        if (skybox) {
            skybox.infiniteDistance = true;
        }
    }

    private setupFog(): void {
        // JS parallel: Linear fog with specific bounds from the inspector.
        this.scene.fogMode = Scene.FOGMODE_LINEAR; // Value 3
        this.scene.fogStart = 0;
        this.scene.fogEnd = 2000;
        this.scene.fogColor = new Color3(0.9, 0.95, 1.0);
    }

    private setupLighting(): void {
        // Ambient soft fill
        const ambientLight = new HemisphericLight("ambientLight", new Vector3(0, 1, 0), this.scene);
        ambientLight.intensity = 0.4;

        // Key light: Positioned far away to ensure broad coverage for shadows
        const keyLight = new DirectionalLight("keyLight", new Vector3(1, -1, 1), this.scene);
        keyLight.intensity = 1.2;
        keyLight.position = new Vector3(-50, 50, -50);

        // Optimization: Handle shadow bounds automatically based on meshes
        keyLight.autoCalcShadowZBounds = true;

        // Shadows
        const shadowGenerator = new ShadowGenerator(2048, keyLight); // Increased resolution for the small island
        shadowGenerator.useBlurExponentialShadowMap = true;
        shadowGenerator.blurKernel = 32;

        (this.scene as any).metadata = this.scene.metadata || {};
        (this.scene as any).metadata.shadowGenerator = shadowGenerator;
    }

    private setupGeometry(): void {
        // We no longer need the slab or fence since we use the floating island model
    }

    private setupCamera(): void {

        const camera = new ArcRotateCamera("camera", Math.PI / 4, Math.PI / 3, 35, Vector3.Zero(), this.scene);

        // Ensure the camera can see out to the massive skybox
        camera.maxZ = 20000;
        // Adjusted limits for floating island viewing
        camera.lowerBetaLimit = 0.1;
        camera.upperBetaLimit = 3; // Allow looking slightly underneath the floating island
        camera.lowerRadiusLimit = 15;
        camera.upperRadiusLimit = 60;

        // Disable panning completely
        camera.panningSensibility = 1500;

        // Attach user control
        camera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);


        // // First Person Camera for debugging
        // const camera = new UniversalCamera("debugCamera", new Vector3(0, 8, -25), this.scene);
        // camera.setTarget(Vector3.Zero());

        // // Flight speed and FOV
        // camera.speed = 0.6;
        // camera.angularSensibility = 1200;
        // camera.maxZ = 20000;
        // // // Attach user control
        // camera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
    }

    private setupDebugLayer(): void {
        // JS parallel: Standard event listener for keyboard input.
        // We use 'keydown' to trigger the action immediately when the key is pressed.
        window.addEventListener("keydown", (ev) => {
            if (ev.key === "d" || ev.key === "D") {
                if (this.scene.debugLayer.isVisible()) {
                    this.scene.debugLayer.hide();
                } else {
                    // This will dynamically load the inspector if it's available
                    this.scene.debugLayer.show();
                }
            }
        });
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
