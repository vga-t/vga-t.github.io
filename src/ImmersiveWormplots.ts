import {
    Scene,
    Vector3,
    Color3,
    MeshBuilder,
    PBRMaterial,
    DynamicTexture,
    TransformNode,
    Mesh,
    Engine
} from '@babylonjs/core';

/**
 * Minimal 3D Perlin Noise Implementation.
 * JS parallel: Since JS math doesn't have native 3D noise generators (unlike GLSL),
 * we need a lightweight algorithmic implementation to drive the non-periodic, 
 * organic writhing without it repeating algorithmically like a sine wave.
 */
class PerlinNoise {
    private p: number[] = new Array(512);

    constructor(seed: number = Math.random()) {
        const permutation = new Array(256).fill(0).map((_, i) => i);
        // Shuffle based on seed
        let x = 0;
        for (let i = 255; i > 0; i--) {
            x = (x + seed * 256) % 256;
            const r = Math.floor(x % (i + 1));
            const temp = permutation[i];
            permutation[i] = permutation[r];
            permutation[r] = temp;
        }

        for (let i = 0; i < 512; i++) {
            this.p[i] = permutation[i % 256];
        }
    }

    private fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    private lerp(t: number, a: number, b: number): number {
        return a + t * (b - a);
    }

    private grad(hash: number, x: number, y: number, z: number): number {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    public noise3D(x: number, y: number, z: number): number {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);

        const A = this.p[X] + Y, AA = this.p[A] + Z, AB = this.p[A + 1] + Z;
        const B = this.p[X + 1] + Y, BA = this.p[B] + Z, BB = this.p[B + 1] + Z;

        return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.p[AA], x, y, z),
            this.grad(this.p[BA], x - 1, y, z)),
            this.lerp(u, this.grad(this.p[AB], x, y - 1, z),
                this.grad(this.p[BB], x - 1, y - 1, z))),
            this.lerp(v, this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1),
                this.grad(this.p[BA + 1], x - 1, y, z - 1)),
                this.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1),
                    this.grad(this.p[BB + 1], x - 1, y - 1, z - 1))));
    }
}

export interface WormplotConfig {
    /** Global scale multiplier for the entire node */
    masterScale: number;
    /** How long the mathematical path of the tube is */
    tubeLength: number;
    /** Base thickness of the tubes */
    baseRadius: number;
    /** How intensely the thickness fluctuates */
    varianceMultiplier: number;
    /** Scale of the noise map (lower translates to broader, smoother curves) */
    noiseScale: number;
    /** Speed at which the data flows through the visualization */
    animationSpeed: number;
    /** Number of points making up each tube's spline */
    pointCount: number;
}

/**
 * Immersive Wormplots
 * 
 * A self-contained, real-time 3D data visualization feature.
 * Generates shape-shifting, writhing tubes using smooth continuous noise
 * to represent statistical groups, ensuring they don't periodically repeat.
 */
export class ImmersiveWormplots {
    private scene: Scene;
    private rootNode: TransformNode;
    private config: WormplotConfig;
    private noiseGen: PerlinNoise;

    private tubes: {
        mesh: Mesh;
        paths: Vector3[];
        color: Color3;
        offset: number; // For non-collision separation and random seeds
    }[] = [];

    private timeElapsed: number = 0;
    private beforeRenderObserver: any;

    constructor(scene: Scene, position: Vector3 = Vector3.Zero(), rotation: Vector3 = Vector3.Zero(), config?: Partial<WormplotConfig>) {
        this.scene = scene;
        this.noiseGen = new PerlinNoise(42); // specific seed for consistency

        // Default constraints for a miniature hologram
        this.config = {
            masterScale: 1,
            tubeLength: 40.0,
            baseRadius: 0.2,
            varianceMultiplier: 5,
            noiseScale: 0.2,
            animationSpeed: 0.1,
            pointCount: 64,
            ...config
        };

        // Root Node Pattern: Allows the whole structure to be moved/scaled universally
        this.rootNode = new TransformNode("wormplotsRoot", this.scene);
        this.rootNode.position = position;
        this.rootNode.scaling = new Vector3(
            this.config.masterScale,
            this.config.masterScale,
            this.config.masterScale
        );
        this.rootNode.rotation = rotation;

        this.initializeTubes();
        this.startAnimation();
    }

    private initializeTubes(): void {
        const groups = [
            { color: new Color3(0, 1, 1), offset: 0 },            // Cyan
            { color: new Color3(1, 0, 1), offset: 100 },          // Magenta
            { color: new Color3(0.5, 1, 0), offset: -100 }        // Lime Green
        ];

        // 1. Create fading opacity texture just once for all tubes
        // JS parallel: Dynamic texture is essentially a DOM canvas mapped onto 3D geometry UVs.
        const opacityTexture = new DynamicTexture("wormFade", { width: 512, height: 2 }, this.scene, false);
        opacityTexture.hasAlpha = true;
        const ctx = opacityTexture.getContext();

        // 1D Gradient across the X axis. Map U-coordinates smoothly to alpha.
        const grd = ctx.createLinearGradient(0, 0, 512, 0);
        grd.addColorStop(0, "rgba(255, 255, 255, 0)");    // Fade start
        grd.addColorStop(0.15, "rgba(255, 255, 255, 1)"); // Solid internal
        grd.addColorStop(0.85, "rgba(255, 255, 255, 1)"); // Solid internal
        grd.addColorStop(1, "rgba(255, 255, 255, 0)");    // Fade end
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, 512, 2);
        opacityTexture.update();

        // 2. Setup each data group
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];

            // Build volumetric material
            const material = new PBRMaterial(`wormplotMat_${i}`, this.scene);
            material.albedoColor = group.color;
            material.metallic = 0.2;
            material.roughness = 0.2;            // Glossy finish for good lighting reaction
            material.useAlphaFromAlbedoTexture = false;

            // Bind the opacity fading gradient
            material.opacityTexture = opacityTexture;
            material.alphaMode = Engine.ALPHA_COMBINE;
            material.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;


            // Generate initial dummy paths (they'll be overwritten in the first render frame)
            const paths: Vector3[] = [];
            for (let p = 0; p < this.config.pointCount; p++) {
                paths.push(new Vector3(0, p, 0));
            }

            const tube = MeshBuilder.CreateTube(`wormplotTube_${i}`, {
                path: paths,
                radius: this.config.baseRadius,
                updatable: true,
                cap: Mesh.NO_CAP
            }, this.scene);

            tube.material = material;
            tube.parent = this.rootNode;

            this.tubes.push({
                mesh: tube,
                paths,
                color: group.color,
                offset: group.offset
            });
        }
    }

    private startAnimation(): void {
        this.beforeRenderObserver = this.scene.onBeforeRenderObservable.add(() => {
            const dt = this.scene.getEngine().getDeltaTime() / 1000.0;
            this.timeElapsed += dt * this.config.animationSpeed;

            for (let t = 0; t < this.tubes.length; t++) {
                const tubeData = this.tubes[t];

                // Radius update function to simulate statistical variance over the tube length
                const radiusFunction = (index: number, _distance: number) => {
                    // Normalizing distance (0 to 1) along the tube
                    const normalizedD = index / (this.config.pointCount - 1);

                    // We sample a separate segment in the noise space for thickness
                    const varianceNoise = this.noiseGen.noise3D(
                        normalizedD * 5.0,
                        tubeData.offset + 50.0,
                        this.timeElapsed
                    );

                    return this.config.baseRadius + (varianceNoise * this.config.varianceMultiplier);
                };

                // Spatial Path Updates (The Writhe)
                for (let i = 0; i < this.config.pointCount; i++) {
                    const normalizedLength = i / (this.config.pointCount - 1);

                    // Linear distribution across the X-axis for baseline placement
                    const baseX = (normalizedLength - 0.5) * this.config.tubeLength;

                    // Spatial noise offsets
                    // We multiply by different arbitrary prime-ish numbers offset by the group
                    // to ensure tubes twist around each other without colliding.
                    const yNoise = this.noiseGen.noise3D(
                        normalizedLength * this.config.tubeLength * this.config.noiseScale,
                        tubeData.offset,
                        this.timeElapsed * 0.5
                    );

                    const zNoise = this.noiseGen.noise3D(
                        normalizedLength * this.config.tubeLength * this.config.noiseScale,
                        tubeData.offset + 200,
                        this.timeElapsed * 0.5
                    );

                    // Add an explicit collision-prevention Z offset based on group index so their bounding cylinders don't perfectly intersect.
                    const spatialPaddingZ = (t - 1) * (this.config.baseRadius * 3);

                    tubeData.paths[i].set(
                        baseX,
                        yNoise * 10.0, // Vertical undulation span
                        zNoise * 8.0 + spatialPaddingZ // Depth undulation span + explicit offset
                    );
                }

                // Apply updates efficiently to the existing mesh vertices
                tubeData.mesh = MeshBuilder.CreateTube(tubeData.mesh.name, {
                    path: tubeData.paths,
                    radiusFunction, // Dynamically calculates thickness using our variance noise
                    instance: tubeData.mesh // Tells Babylon we are updating vertices, not allocating new Memory
                }, this.scene);
            }
        });
    }

    /** Cleanup function handling memory de-allocations */
    public dispose(): void {
        if (this.beforeRenderObserver) {
            this.scene.onBeforeRenderObservable.remove(this.beforeRenderObserver);
        }

        for (const t of this.tubes) {
            if (t.mesh) {
                // Because we are using an instanced PBR Material and Texture across all tubes,
                // we'll handle material disposal on the mesh drop
                if (t.mesh.material) {
                    const opacityText = (t.mesh.material as PBRMaterial).opacityTexture;
                    if (opacityText) opacityText.dispose();
                    t.mesh.material.dispose();
                }
                t.mesh.dispose();
            }
        }

        this.rootNode.dispose();
    }
}


