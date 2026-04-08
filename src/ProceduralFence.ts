import { Scene, MeshBuilder, PBRMaterial, Color3, Vector3, Mesh, InstancedMesh } from '@babylonjs/core';

/**
 * Constructs a procedural perimeter fence.
 * Uses instancing to ensure high performance with a Post, Rail, and Slat design.
 * JS parallel: This is a factory class for generating complex, repeated geometry efficiently.
 */
export class ProceduralFence {
    /**
     * Builds the fence around a bounding rectangle.
     * @param scene The Babylon Scene
     * @param width The total width of the area (X axis)
     * @param depth The total depth of the area (Z axis)
     */
    public static build(scene: Scene, width: number, depth: number): void {
        const postMat = new PBRMaterial("postWood", scene);
        postMat.albedoColor = Color3.FromHexString("#2e1c14"); // Dark wood
        postMat.metallic = 0.05;
        postMat.roughness = 0.8;

        const slatMat = new PBRMaterial("slatWood", scene);
        slatMat.albedoColor = Color3.FromHexString("#3E2723"); // Slightly lighter wood
        slatMat.metallic = 0.05;
        slatMat.roughness = 0.85;

        // Base meshes for instancing
        const postBase = MeshBuilder.CreateBox("postBase", { width: 0.1, height: 0.8, depth: 0.1 }, scene);
        postBase.material = postMat;
        
        let railBase = MeshBuilder.CreateBox("railBase", { width: 1.0, height: 0.04, depth: 0.04 }, scene);
        railBase.material = slatMat;

        let slatBase = MeshBuilder.CreateBox("slatBase", { width: 0.08, height: 0.7, depth: 0.02 }, scene);
        slatBase.material = slatMat;

        const instances: (Mesh | InstancedMesh)[] = [postBase, railBase, slatBase];

        const buildLine = (start: Vector3, end: Vector3, segmentLength: number, direction: Vector3, normal: Vector3, isFirstLine: boolean) => {
            const distance = Vector3.Distance(start, end);
            const numSegments = Math.ceil(distance / segmentLength);
            const actualSegment = distance / numSegments;

            for (let i = 0; i <= numSegments; i++) {
                const pos = start.add(direction.scale(i * actualSegment));

                // Places the post
                let post: Mesh | InstancedMesh;
                if (isFirstLine && i === 0) {
                    post = postBase;
                } else {
                    post = postBase.createInstance("postInst");
                    instances.push(post);
                }
                post.position = new Vector3(pos.x, 0.4, pos.z); // Center is half-height

                // If not the last post, build rails and slats to the next post
                if (i < numSegments) {
                    const nextPos = start.add(direction.scale((i + 1) * actualSegment));
                    const midPoint = Vector3.Center(pos, nextPos);
                    const angle = Math.atan2(direction.x, direction.z) - Math.PI / 2;

                    // Lower Rail
                    let lowRail = railBase.createInstance("railInst");
                    lowRail.position = new Vector3(midPoint.x, 0.2, midPoint.z);
                    lowRail.rotation.y = angle;
                    lowRail.scaling.x = actualSegment; // Scale it to reach exactly
                    instances.push(lowRail);

                    // Upper Rail
                    let upRail = railBase.createInstance("railInst");
                    upRail.position = new Vector3(midPoint.x, 0.6, midPoint.z);
                    upRail.rotation.y = angle;
                    upRail.scaling.x = actualSegment;
                    instances.push(upRail);

                    // Slats
                    const numSlats = Math.floor(actualSegment / 0.15); // Slat every 0.15 units
                    const slatSpacing = actualSegment / numSlats;

                    for (let s = 1; s < numSlats; s++) {
                        let slat: Mesh | InstancedMesh;
                        if (isFirstLine && i === 0 && s === 1) {
                            slat = slatBase;
                        } else {
                            slat = slatBase.createInstance("slatInst");
                            instances.push(slat);
                        }

                        const slatPos = pos.add(direction.scale(s * slatSpacing));
                        // Offset slat onto the face of the rail based on normal
                        slat.position = new Vector3(
                            slatPos.x + normal.x * 0.03, 
                            0.4, 
                            slatPos.z + normal.z * 0.03
                        );
                        
                        // +/- 1 degree random twist for realism
                        const twist = (Math.random() - 0.5) * (Math.PI / 90);
                        slat.rotation.y = angle + twist;
                    }
                }
            }
        };

        // We build four lines for the four edges: (+Z), (-Z), (+X), (-X)
        const halfW = width / 2;
        const halfD = depth / 2;

        // Top edge: Top-Left to Top-Right
        buildLine(new Vector3(-halfW, 0, halfD), new Vector3(halfW, 0, halfD), 1.5, new Vector3(1, 0, 0), new Vector3(0, 0, 1), true);
        
        // Bottom edge: Bottom-Right to Bottom-Left
        buildLine(new Vector3(halfW, 0, -halfD), new Vector3(-halfW, 0, -halfD), 1.5, new Vector3(-1, 0, 0), new Vector3(0, 0, -1), false);
        
        // Right edge: Top-Right to Bottom-Right
        buildLine(new Vector3(halfW, 0, halfD), new Vector3(halfW, 0, -halfD), 1.5, new Vector3(0, 0, -1), new Vector3(1, 0, 0), false);
        
        // Left edge: Bottom-Left to Top-Left
        buildLine(new Vector3(-halfW, 0, -halfD), new Vector3(-halfW, 0, halfD), 1.5, new Vector3(0, 0, 1), new Vector3(-1, 0, 0), false);

        // Turn off visibility for the unused base rail (we instanced it on the first line but never placed the root)
        railBase.isVisible = false; 
        
        // For physics logic or static geometry optimization
        instances.forEach(mesh => {
            if (mesh) {
                // Instanced mesh doesn't implement all freeze logic exactly like root, 
                // but setting receiveShadows works.
                if (mesh instanceof InstancedMesh) {
                   mesh.freezeWorldMatrix();
                } else if (mesh instanceof Mesh) {
                   mesh.freezeWorldMatrix();
                }
            }
        });
    }
}
