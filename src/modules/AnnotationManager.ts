import {
    Scene,
    Vector3,
    TransformNode,
    AbstractMesh,
    Matrix,
    Viewport,
    Observer
} from '@babylonjs/core';
import {
    AdvancedDynamicTexture,
    StackPanel,
    TextBlock,
    Control
} from '@babylonjs/gui';
import type { AnnotationConfig } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Scratch allocations — reused every frame to avoid garbage-collection pressure.
// JS parallel: Like pre-allocating a buffer once instead of malloc-ing each frame.
// ─────────────────────────────────────────────────────────────────────────────
const _scratchScreen   = new Vector3();
const _changeEpsilon   = 0.001; // world-unit threshold before console output fires

/**
 * Manages 2D GUI annotations displayed above 3D models in the scene.
 *
 * Architecture
 * ─────────────
 * • One `AdvancedDynamicTexture` (fullscreen) is shared across all annotations
 *   (single 2D draw call — zero 3D triangle overhead per label).
 * • Each annotation gets an `annotAnchor_<name>` TransformNode that is visible
 *   in the Babylon Inspector and can be moved with the translate gizmo.
 * • A per-frame observer projects the anchor's world position to screen XY and
 *   repositions the GUI panel accordingly.
 * • Change detection: when the anchor is moved inside the Inspector the console
 *   prints a ready-to-paste `worldOffset` tuple.
 *
 * JS parallel: Equivalent to a CSS-positioned <div> following a 3D object,
 * calculated with getBoundingClientRect + CSS `transform: translate`.
 */
export class AnnotationManager {

    /** Lazily created singleton — one shared GUI layer for the whole scene */
    private static _guiTexture: AdvancedDynamicTexture | null = null;

    // ── Internal bookkeeping ────────────────────────────────────────────────
    /**
     * Returns (or lazily creates) the shared fullscreen GUI texture.
     * This texture is the 2D canvas layered on top of the WebGL viewport.
     */
    private static getGUI(scene: Scene): AdvancedDynamicTexture {
        if (!this._guiTexture) {
            this._guiTexture = AdvancedDynamicTexture.CreateFullscreenUI(
                'annotationLayer',
                true,   // foreground = renders on top
                scene
            );
            // Disable ideal-size rescaling so pixel values are always literal pixels.
            this._guiTexture.renderScale = 1;
        }
        return this._guiTexture;
    }

    // ── Public API ──────────────────────────────────────────────────────────

    /**
     * Creates 2D GUI text labels anchored above `targetNode` in world space.
     *
     * Returns the anchor TransformNode so callers can store and reposition it
     * programmatically if desired.
     *
     * @param scene      The BabylonJS scene
     * @param targetNode The model/structure to annotate
     * @param config     Styling and content configuration
     */
    public static addAnnotations(
        scene: Scene,
        targetNode: TransformNode | AbstractMesh,
        config: AnnotationConfig
    ): TransformNode {
        const { lines } = config;

        // ── Style defaults ──────────────────────────────────────────────────
        const colorHex    = config.color       ?? '#FFFFFF';
        const fontSize    = config.size        ?? 20;          // px
        const fontWeight  = config.fontWeight  ?? 'bold';
        const fontFamily  = config.fontFamily  ?? 'Arial';
        const lineSpacing = config.lineSpacing ?? 4;           // px between lines

        // ── Model absolute position (world space) ───────────────────────────
        // Captured early so BOTH the anchor placement AND the console output
        // use the same reference point (model origin), keeping them consistent.
        // This is the critical fix: worldOffset is always relative to this value.
        const modelAbsPos = targetNode.getAbsolutePosition().clone();

        // ── Bounding-box computation (world space) ──────────────────────────
        // We walk every child mesh and accumulate world-space min/max so that
        // even meshes with negative scaling (e.g. LinkedIn right-handed flip)
        // or deeply nested hierarchies are handled correctly.
        let wMin = new Vector3( Infinity,  Infinity,  Infinity);
        let wMax = new Vector3(-Infinity, -Infinity, -Infinity);

        const allMeshes: (TransformNode | AbstractMesh)[] = [targetNode];
        allMeshes.push(...targetNode.getChildMeshes(false));

        // Force world matrix refresh before sampling bounding boxes
        targetNode.computeWorldMatrix(true);

        for (const m of allMeshes) {
            if (!(m instanceof AbstractMesh) || !m.isVisible) continue;
            m.computeWorldMatrix(true);
            m.refreshBoundingInfo(true, true);
            const bbox = m.getBoundingInfo().boundingBox;
            wMin = Vector3.Minimize(wMin, bbox.minimumWorld);
            wMax = Vector3.Maximize(wMax, bbox.maximumWorld);
        }

        // Fallback: if no visible mesh was found, place at the node's origin
        if (!isFinite(wMin.x)) {
            wMin.copyFrom(modelAbsPos);
            wMax.copyFrom(modelAbsPos);
        }

        const modelCenter = wMax.add(wMin).scale(0.5);
        const topY        = wMax.y;

        // ── Relative offset (model-space, world units) ──────────────────────
        // This is the mutable closure state. The observer updates it when the
        // user drags the anchor gizmo in the Inspector.
        // relOffset  =  desired anchor world pos  −  model world pos
        // Initialised:
        //   A) from config.worldOffset when provided (exact, stable)
        //   B) from bbox auto-placement when not provided
        const relOffset = new Vector3();

        if (config.worldOffset) {
            const [ox, oy, oz] = config.worldOffset;
            relOffset.set(ox, oy, oz);
        } else {
            // Auto: centre XZ on bbox, float above the top
            const defaultLift = (fontSize / 14) * 1.5;
            relOffset.set(
                modelCenter.x - modelAbsPos.x,
                (topY + defaultLift) - modelAbsPos.y,
                modelCenter.z - modelAbsPos.z
            );
        }

        // ── Anchor TransformNode ────────────────────────────────────────────
        // Intentionally at ROOT LEVEL (no parent) so that:
        //   a) Negative-scale parents (LinkedIn) don't distort the math.
        //   b) The Inspector gizmo operates in clean world space.
        // The observer keeps this in sync with (model position + relOffset) every frame,
        // so the Inspector gizmo always sits exactly on the label.
        const anchorName = `annotAnchor_${targetNode.name}`;
        const anchor = new TransformNode(anchorName, scene);
        // Place at initial position
        anchor.position.set(
            modelAbsPos.x + relOffset.x,
            modelAbsPos.y + relOffset.y,
            modelAbsPos.z + relOffset.z
        );

        // ── GUI panel ───────────────────────────────────────────────────────
        const gui = this.getGUI(scene);

        const panel = new StackPanel(`annoPanel_${targetNode.name}`);
        panel.isVertical       = true;
        panel.isHitTestVisible = false;    // labels don't capture mouse events
        panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        panel.verticalAlignment   = Control.VERTICAL_ALIGNMENT_TOP;

        // We'll set widthInPixels once we know the longest line's character count
        const maxChars = Math.max(...lines.map(l => l.length));
        // Rough pixel-width estimate per character (varies by font, good enough for centering)
        const estimatedCharWidth = fontSize * 0.6;
        const panelWidth = Math.ceil(maxChars * estimatedCharWidth) + 16; // 8px padding each side
        panel.widthInPixels = panelWidth;

        let totalHeight = 0;

        for (let i = 0; i < lines.length; i++) {
            const tb = new TextBlock(`annoText_${targetNode.name}_${i}`, lines[i]);
            tb.color               = colorHex;
            tb.fontSize            = fontSize;
            tb.fontFamily          = fontFamily;
            tb.fontWeight          = fontWeight;
            tb.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
            tb.textVerticalAlignment   = Control.VERTICAL_ALIGNMENT_TOP;
            tb.heightInPixels      = fontSize + lineSpacing;
            tb.widthInPixels       = panelWidth;
            tb.isHitTestVisible    = false;

            // Visibility-friendly: slightly dark outline via shadow (not a separate mesh)
            tb.shadowColor   = 'rgba(0,0,0,0.8)';
            tb.shadowOffsetX = 1;
            tb.shadowOffsetY = 1;
            tb.shadowBlur    = 2;

            panel.addControl(tb);
            totalHeight += fontSize + lineSpacing;
        }

        panel.heightInPixels = totalHeight;
        gui.addControl(panel);

        // ── Per-frame tracking observer ─────────────────────────────────────
        // Core logic each frame:
        //   1. Read anchor's current position.
        //   2. Read model's LIVE absolute position (catches Inspector moves on the model).
        //   3. If the anchor moved MORE than (model moved + epsilon) → USER dragged the anchor
        //      → update relOffset and print copy-paste worldOffset to console.
        //   4. Compute label world pos = modelLivePos + relOffset.
        //   5. Sync anchor to label pos so the Inspector gizmo always tracks the label.
        //   6. Project label world pos to screen, reposition GUI panel.
        //
        // Optimization: Viewport and all scratch Vectors are allocated ONCE outside
        // the hot-path callback to prevent per-frame GC pressure.
        // JS parallel: equivalent to storing state in a closure / RAF callback.

        // Per-annotation scratch vectors (one set per annotation, allocated once)
        const _liveModelPos = modelAbsPos.clone();   // live model world pos (re-filled each frame)
        const _liveLabelPos = new Vector3();          // model + relOffset (re-filled each frame)
        const _lastSyncedAnchorPos = anchor.position.clone(); // what WE last set the anchor to

        let lastOutputTime = 0; // throttle console output (ms)

        // Pre-allocate viewport — engine dimensions rarely change, we update it lazily
        let _vp = new Viewport(0, 0,
            scene.getEngine().getRenderWidth(),
            scene.getEngine().getRenderHeight()
        );
        let _lastVpW = _vp.width, _lastVpH = _vp.height;

        const observer: Observer<Scene> = scene.onAfterRenderObservable.add(() => {
            if (!scene.activeCamera) return;

            // ── 1. Sample model's live world position ───────────────────────
            // For static (frozen) models this is stable. For moved Inspector nodes,
            // Babylon.js updates absolutePosition automatically when position changes.
            _liveModelPos.copyFrom(targetNode.getAbsolutePosition());

            // ── 2. Detect USER anchor drag ───────────────────────────────────
            // _lastSyncedAnchorPos is what we set last frame.
            // If anchor.position differs, the Inspector (or external code) moved it.
            const anchorPos = anchor.position; // direct reference, no alloc
            if (!anchorPos.equalsWithEpsilon(_lastSyncedAnchorPos, _changeEpsilon)) {
                // User moved the anchor → derive new relOffset from anchor − model
                relOffset.set(
                    anchorPos.x - _liveModelPos.x,
                    anchorPos.y - _liveModelPos.y,
                    anchorPos.z - _liveModelPos.z
                );

                // Throttle console output to avoid flooding while dragging
                const now = performance.now();
                if (now - lastOutputTime > 300) {
                    lastOutputTime = now;
                    const fmt = (v: number) => v.toFixed(3);
                    console.log(
                        `%c[Annotation "${lines[0]}"] Anchor moved!\n` +
                        `  worldOffset: [${fmt(relOffset.x)}, ${fmt(relOffset.y)}, ${fmt(relOffset.z)}]\n` +
                        `  → Paste into source:  worldOffset: [${fmt(relOffset.x)}, ${fmt(relOffset.y)}, ${fmt(relOffset.z)}]`,
                        'color: #4FC3F7; font-weight: bold;'
                    );
                }
            }

            // ── 3. Compute label world position ─────────────────────────────
            // Always model LIVE pos + relOffset, so moving the model moves the label.
            _liveLabelPos.set(
                _liveModelPos.x + relOffset.x,
                _liveModelPos.y + relOffset.y,
                _liveModelPos.z + relOffset.z
            );

            // ── 4. Sync anchor to label position ────────────────────────────
            // Keeps the Inspector gizmo positioned exactly on the label,
            // so after the model moves the gizmo moves with it.
            anchor.position.copyFrom(_liveLabelPos);
            _lastSyncedAnchorPos.copyFrom(_liveLabelPos);

            // ── 5. Update viewport if engine was resized ─────────────────────
            const engine = scene.getEngine();
            const vpW = engine.getRenderWidth();
            const vpH = engine.getRenderHeight();
            if (vpW !== _lastVpW || vpH !== _lastVpH) {
                _vp = new Viewport(0, 0, vpW, vpH);
                _lastVpW = vpW; _lastVpH = vpH;
            }

            // ── 6. Project label world pos → screen pixels ───────────────────
            Vector3.ProjectToRef(
                _liveLabelPos,
                Matrix.IdentityReadOnly,
                scene.getTransformMatrix(),
                _vp,
                _scratchScreen
            );

            // z < 0 or > 1 means behind the camera — hide panel
            if (_scratchScreen.z < 0 || _scratchScreen.z > 1) {
                panel.isVisible = false;
                return;
            }

            panel.isVisible = true;
            panel.leftInPixels = _scratchScreen.x - panelWidth / 2;
            panel.topInPixels  = _scratchScreen.y - totalHeight / 2;
        })!;

        // Attach observer reference to anchor for cleanup
        (anchor as any).__annotObserver = observer;

        return anchor;
    }

    /**
     * Removes a single annotation by its anchor TransformNode.
     * Disposes the associated GUI control and scene observer.
     */
    public static removeAnnotation(scene: Scene, anchor: TransformNode): void {
        const observer = (anchor as any).__annotObserver as Observer<Scene> | undefined;
        if (observer) {
            scene.onAfterRenderObservable.remove(observer);
        }

        // Find and remove the associated GUI panel by naming convention
        if (this._guiTexture) {
            const panelName = anchor.name.replace('annotAnchor_', 'annoPanel_');
            const control = this._guiTexture.getControlByName(panelName);
            if (control) {
                this._guiTexture.removeControl(control);
                control.dispose();
            }
        }

        anchor.dispose();
    }

    /**
     * Disposes the shared GUI texture and all observers.
     * Call when tearing down the scene entirely.
     */
    public static disposeAll(): void {
        if (this._guiTexture) {
            this._guiTexture.dispose();
            this._guiTexture = null;
        }
    }
}
