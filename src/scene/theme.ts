/**
 * The Lantern Room — palette and material factory.
 *
 * Every material is created here so the accessibility "Contrast" setting can
 * re-tint the whole room in one place. The high-contrast palette raises
 * luminance separation (darker room, brighter brass and runes) without changing
 * geometry, so the layout stays exactly as designed.
 */
import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Side,
} from '@iwsdk/core';

export interface Palette {
  name: 'Comfort' | 'High contrast';
  floor: number;
  woodTop: number;
  woodEdge: number;
  brass: number;
  brassBright: number;
  iron: number;
  felt: number;
  glass: number;
  rune: number;
  star: number;
  warm: number;
  cool: number;
  core: number;
  ember: number;
  brine: number;
  moss: number;
  text: number;
  glowSoft: number;
}

export const COMFORT_PALETTE: Palette = {
  name: 'Comfort',
  floor: 0x1c1712,
  woodTop: 0x3b2a1b,
  woodEdge: 0x271b11,
  brass: 0xa87a42,
  brassBright: 0xe6bd76,
  iron: 0x2e2b31,
  felt: 0x4a1f24,
  glass: 0x2a4c66,
  rune: 0xffd9a0,
  star: 0xcfd9ff,
  warm: 0xffb35c,
  cool: 0x86b8ff,
  core: 0xffdca6,
  ember: 0xff8a5c,
  brine: 0x7fd4ff,
  moss: 0xa8e6a1,
  text: 0xf6e7c8,
  glowSoft: 0x574779,
};

export const HIGH_CONTRAST_PALETTE: Palette = {
  name: 'High contrast',
  floor: 0x050609,
  woodTop: 0x3d2f20,
  woodEdge: 0x161006,
  brass: 0xc79a52,
  brassBright: 0xfff0c0,
  iron: 0x0d0e12,
  felt: 0x5c1218,
  glass: 0x14334d,
  rune: 0xfff6d8,
  star: 0xffffff,
  warm: 0xffc46e,
  cool: 0x9fd0ff,
  core: 0xfff2cf,
  ember: 0xff7a3c,
  brine: 0x63ccff,
  moss: 0x9bff92,
  text: 0xffffff,
  glowSoft: 0x3f3270,
};

interface StandardOptions {
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: Side;
  flatShading?: boolean;
}

interface BasicOptions {
  transparent?: boolean;
  opacity?: number;
  blending?: typeof AdditiveBlending;
  side?: Side;
  depthWrite?: boolean;
  toneMapped?: boolean;
}

interface RegisteredStandard {
  material: MeshStandardMaterial;
  color: { comfort: number; contrast: number };
  emissive?: { comfort: number; contrast: number };
}

interface RegisteredBasic {
  material: MeshBasicMaterial;
  color: { comfort: number; contrast: number };
}

export class RoomTheme {
  readonly comfort = COMFORT_PALETTE;
  readonly contrast = HIGH_CONTRAST_PALETTE;
  private highContrast = false;
  private readonly standardMaterials: RegisteredStandard[] = [];
  private readonly basicMaterials: RegisteredBasic[] = [];
  private readonly numericTargets: Array<{
    apply: (palette: Palette) => void;
  }> = [];

  get palette(): Palette {
    return this.highContrast ? HIGH_CONTRAST_PALETTE : COMFORT_PALETTE;
  }

  get isHighContrast(): boolean {
    return this.highContrast;
  }

  /** Create a registered standard material. */
  standard(comfortColor: number, options: StandardOptions = {}, contrastColor?: number): MeshStandardMaterial {
    const material = new MeshStandardMaterial({
      color: comfortColor,
      roughness: options.roughness ?? 0.65,
      metalness: options.metalness ?? 0.1,
      transparent: options.transparent ?? false,
      opacity: options.opacity ?? 1,
      side: options.side ?? DoubleSide,
      flatShading: options.flatShading ?? false,
    });
    if (options.emissive != null) {
      material.emissive = new Color(options.emissive);
      material.emissiveIntensity = options.emissiveIntensity ?? 1;
    }
    this.standardMaterials.push({
      material,
      color: { comfort: comfortColor, contrast: contrastColor ?? comfortColor },
      emissive:
        options.emissive != null
          ? { comfort: options.emissive, contrast: options.emissive }
          : undefined,
    });
    return material;
  }

  /** Create a registered unlit/basic material (emissive props, glow cards). */
  basic(comfortColor: number, contrastColor?: number, options: BasicOptions = {}): MeshBasicMaterial {
    const material = new MeshBasicMaterial({
      color: comfortColor,
      transparent: options.transparent ?? false,
      opacity: options.opacity ?? 1,
      side: options.side ?? BackSide,
      depthWrite: options.depthWrite ?? true,
      toneMapped: options.toneMapped ?? true,
    });
    if (options.blending != null) {
      material.blending = options.blending;
    }
    this.basicMaterials.push({
      material,
      color: { comfort: comfortColor, contrast: contrastColor ?? comfortColor },
    });
    return material;
  }

  /**
   * Register a custom numeric hook (light intensity, emissive intensity, …) that
   * is re-applied whenever the contrast setting changes.
   */
  onPaletteChange(apply: (palette: Palette) => void): void {
    this.numericTargets.push({ apply });
    apply(this.palette);
  }

  setHighContrast(on: boolean): void {
    if (this.highContrast === on) {
      return;
    }
    this.highContrast = on;
    for (const entry of this.standardMaterials) {
      entry.material.color.setHex(on ? entry.color.contrast : entry.color.comfort);
      if (entry.emissive != null) {
        entry.material.emissive.setHex(
          on ? entry.emissive.contrast : entry.emissive.comfort,
        );
      }
    }
    for (const entry of this.basicMaterials) {
      entry.material.color.setHex(on ? entry.color.contrast : entry.color.comfort);
    }
    for (const target of this.numericTargets) {
      target.apply(this.palette);
    }
  }
}
