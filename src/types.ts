import { ShadowGenerator } from '@babylonjs/core';

/**
 * Represents the different states of the portfolio application.
 * Using a const object + union type instead of enum to satisfy 'erasableSyntaxOnly'.
 * JS parallel: This is equivalent to a plain object in JavaScript for storing constants.
 */
export const PortfolioState = {
    HUB: 'HUB',
    TRANSITION: 'TRANSITION',
    DETAIL: 'DETAIL'
} as const;

export type PortfolioState = (typeof PortfolioState)[keyof typeof PortfolioState];


/**
 * Configuration for the Diorama geometry.
 * JS parallel: Similar to a simple config object literal to ensure proper parameter shapes.
 */
export interface DioramaConfig {
    width: number;
    depth: number;
    height: number;
}

/**
 * Interface for model transformation parameters.
 * JS parallel: This is like a configuration object used to group related properties.
 */
export interface ModelTransform {
    fileName: string;
    position?: import('@babylonjs/core').Vector3;
    rotation?: import('@babylonjs/core').Vector3; // Euler angles in radians
    scaling?: import('@babylonjs/core').Vector3;
    coordinateSystem?: string;
    shadowGenerator?: ShadowGenerator;
    animate?: boolean;
    clickUrl?: string;
    annotations?: AnnotationConfig;
}

/**
 * Configuration for 2D GUI annotations displayed above 3D models.
 * These annotations are rendered via AdvancedDynamicTexture (single 2D draw pass).
 *
 * Inspector workflow:
 *   Move the `annotAnchor_<name>` TransformNode in the Inspector to visually place the label.
 *   The console will print ready-to-paste `worldOffset` values each time you move it.
 *
 * JS parallel: This is like a CSS-style configuration object for a DOM text element.
 */
export interface AnnotationConfig {
    /** The text rows to render, top-to-bottom */
    lines: string[];
    /** CSS hex colour for the text, e.g. "#00FF88". Defaults to "#FFFFFF" */
    color?: string;
    /** Font size in pixels, e.g. 20. Defaults to 20 */
    size?: number;
    /**
     * CSS font-weight: "normal" | "bold" | "600" | "900" etc.
     * Higher weights = thicker strokes = better readability on dark backgrounds.
     * Defaults to "bold".
     */
    fontWeight?: string;
    /**
     * CSS font-family, e.g. "Arial", "Outfit", "Inter".
     * Defaults to "Arial".
     */
    fontFamily?: string;
    /** Extra vertical gap between lines in pixels. Defaults to 4 */
    lineSpacing?: number;
    /**
     * XYZ offset from the model's world-space origin, in world units.
     * Use a plain tuple so it can be copy-pasted directly from the console output.
     * e.g. [0, 3.5, 0]  →  label floats 3.5 units above origin.
     */
    worldOffset?: [number, number, number];
}
