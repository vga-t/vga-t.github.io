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
