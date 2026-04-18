import {
    Scene,
    Vector3,
    TransformNode,
    MeshBuilder,
    PBRMaterial,
    Color3,
    Matrix,
    Mesh,
    ActionManager,
    ExecuteCodeAction
} from '@babylonjs/core';

export interface DataWallConfig {
    displayWidth: number;
    displayHeight: number;
    rows: number;
    columns: number;
    clickUrl?: string;
}

/**
 * A highly performant, flat "Heatmap" data wall representing Tabular Data.
 * Uses Thin Instances for optimal performance.
 * JS parallel: A reusable DOM component equivalent, encapsulating its template and style without heavy class inheritance.
 */
export class DataWallHeatmap {
    public root: TransformNode;
    private scene: Scene;

    constructor(
        scene: Scene,
        position: Vector3 = Vector3.Zero(),
        rotation: Vector3 = Vector3.Zero(),
        scaling: Vector3 = Vector3.One(),
        config: Partial<DataWallConfig> = {}
    ) {
        const fullConfig: DataWallConfig = {
            displayWidth: 10,
            displayHeight: 5,
            rows: 20,
            columns: 30,
            ...config
        };

        this.scene = scene;

        // The Root Node: Parent everything to a single invisible TransformNode.
        this.root = new TransformNode("dataWallRoot", this.scene);
        this.root.position = position;
        this.root.rotation = rotation;
        this.root.scaling = scaling;

        this.buildWall(fullConfig);
    }

    private buildWall(config: DataWallConfig): void {
        const { displayWidth, displayHeight, rows, columns } = config;

        // 1. The Backboard
        // A flat, thin box to act as the primary screen/glass backboard.
        const glassDepth = 0.1;
        const padding = 0.05;
        const backboard = MeshBuilder.CreateBox("dataWallBackboard", {
            width: displayWidth + padding,
            height: displayHeight + padding,
            depth: glassDepth
        }, this.scene);
        backboard.parent = this.root;

        // Material for The Glass Wall
        // Highly transparent, dark PBR material that catches environmental reflections.
        const glassMaterial = new PBRMaterial("dataWallGlass", this.scene);
        glassMaterial.alpha = 0.4;
        glassMaterial.albedoColor = new Color3(0.05, 0.05, 0.05); // dark tinted
        glassMaterial.metallic = 0.9;
        glassMaterial.roughness = 0.1; // catches reflections well
        glassMaterial.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
        glassMaterial.backFaceCulling = false;
        backboard.material = glassMaterial;

        // 2. The Data Grid
        // Cells size & gap calculation
        const gapBase = 0.005; // Small gap between cells
        const cellWidth = (displayWidth / columns) - gapBase;
        const cellHeight = (displayHeight / rows) - gapBase;

        // Base cell mesh for thin instancing
        const cellMesh = MeshBuilder.CreatePlane("dataWallCell", {
            width: cellWidth,
            height: cellHeight,
            sideOrientation: Mesh.DOUBLESIDE
        }, this.scene);

        // Position cellMesh slightly in front of the backboard to avoid Z-fighting
        cellMesh.position.z = -(glassDepth / 2) - 0.01;
        cellMesh.parent = this.root;

        // Material for The Green Heatmap
        // We use unlit material so the instanced colors act like raw neon values ignoring lighting.
        const cellMaterial = new PBRMaterial("dataWallHeatmapMaterial", this.scene);
        cellMaterial.unlit = true;
        cellMaterial.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
        cellMaterial.backFaceCulling = false;
        cellMesh.material = cellMaterial;

        // 3. Thin Instance Generation
        const instanceCount = rows * columns;
        const matricesData = new Float32Array(16 * instanceCount);
        const colorData = new Float32Array(4 * instanceCount);

        // Monochromatic Green Heatmap base color
        const neonGreen = new Color3(0.1, 1.0, 0.2);
        let index = 0;

        // Calculate offset to center the grid on the backboard
        const startX = -(displayWidth / 2) + (cellWidth / 2) + (gapBase / 2);
        const startY = (displayHeight / 2) - (cellHeight / 2) - (gapBase / 2);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
                // Compute position for the current cell
                const x = startX + c * (cellWidth + gapBase);
                const y = startY - r * (cellHeight + gapBase);
                const z = 0; // Relative to cellMesh's z which is already offset

                // Matrix for position using Babylon's math helpers
                // JS parallel: creating and placing individual elements in the DOM dynamically.
                const matrix = Matrix.Translation(x, y, z);
                matrix.copyToArray(matricesData, index * 16);

                // Value Mapping (Random value between 0.0 and 1.0)
                const dataValue = Math.random();

                // Intensity logic: 1.0 = bright glowing neon green, 0.1 = dull dark green
                // We map this into the color buffer.
                const intensity = Math.max(0.1, dataValue);
                colorData[index * 4 + 0] = neonGreen.r * intensity; // R
                colorData[index * 4 + 1] = neonGreen.g * intensity; // G
                colorData[index * 4 + 2] = neonGreen.b * intensity; // B
                // Keep some minimum alpha to stay visible even when dark
                colorData[index * 4 + 3] = Math.max(0.2, dataValue); // Alpha

                index++;
            }
        }

        cellMesh.thinInstanceSetBuffer("matrix", matricesData, 16);
        cellMesh.thinInstanceSetBuffer("color", colorData, 4);

        // Optimize performance by skipping picking logic for the inner thin instances
        cellMesh.thinInstanceEnablePicking = false;

        // Implement click functionality if a URL is provided
        // JS parallel: Generic click handler applied to both the frame and the data grid.
        if (config.clickUrl) {
            [backboard, cellMesh].forEach(mesh => {
                mesh.actionManager = new ActionManager(this.scene);
                mesh.actionManager.registerAction(
                    new ExecuteCodeAction(ActionManager.OnPickTrigger, () => {
                        window.open(config.clickUrl, '_blank');
                    })
                );

                mesh.actionManager.registerAction(
                    new ExecuteCodeAction(ActionManager.OnPointerOverTrigger, () => {
                        const canvas = this.scene.getEngine().getRenderingCanvas();
                        if (canvas) canvas.style.cursor = "pointer";
                    })
                );

                mesh.actionManager.registerAction(
                    new ExecuteCodeAction(ActionManager.OnPointerOutTrigger, () => {
                        const canvas = this.scene.getEngine().getRenderingCanvas();
                        if (canvas) canvas.style.cursor = "default";
                    })
                );
            });
        }
    }
}
