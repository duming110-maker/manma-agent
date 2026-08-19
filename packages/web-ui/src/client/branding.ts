/**
 * Build-time branding constants (iron rule 5): the single source is
 * branding/default/branding.yaml, read by build.mjs at BUILD time and
 * injected here wholesale through esbuild `define` (no runtime file read).
 * The `__BC_BRANDING__` reference below is not a fallback — an unbuilt or
 * mis-injected bundle throws ReferenceError at module materialization
 * (fail-loud, never a silent hardcoded brand).
 */

/**
 * A brand-localized UI string: the per-language dictionary form of docs/03 §9
 * ({ zh, en }); the branding yaml may spell a single value when the brand
 * name is identical in both languages (build.mjs normalizes the form).
 */
export interface BcBrandingName {
  zh: string
  en: string
}

/** The branding slice this shell consumes (single source: branding.yaml). */
export interface BcBranding {
  /** Product name as shown in the sidebar brand area, per language. */
  product: { name: BcBrandingName }
  /** Primary palette tiers (light + dark), CSS color values. */
  theme: {
    primary: string
    primaryHover: string
    primaryActive: string
    primaryDark: string
    primaryDarkHover: string
    primaryDarkActive: string
  }
}

// Build-time define target: build.mjs replaces this identifier with the JSON
// literal compiled from branding/default/branding.yaml.
declare const __BC_BRANDING__: string

/** The branding constants (parsed once at materialization). */
export const BRANDING: BcBranding = JSON.parse(__BC_BRANDING__)
