/**
 * Canvas-texture text and glow sprites.
 *
 * The Lantern Room ships no font files and makes no network requests, so all
 * lettering is drawn into an HTML canvas at runtime with the platform's
 * default sans-serif stack and uploaded as a texture. That keeps the build
 * self-contained and the copy crisp on both desktop and Quest.
 */
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  SRGBColorSpace,
} from '@iwsdk/core';

export interface TextTextureOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  color?: string;
  glow?: string;
  weight?: number;
  letterSpacing?: number;
  align?: 'left' | 'center';
  /** Transparent background, or an optional translucent panel color. */
  background?: string;
}

export interface TextTextureResult {
  texture: CanvasTexture;
  canvas: HTMLCanvasElement;
}

/** Create a canvas texture containing one line of text. */
export function createTextTexture(
  text: string,
  options: TextTextureOptions = {},
): TextTextureResult {
  const width = options.width ?? 1024;
  const height = options.height ?? 192;
  const fontSize = options.fontSize ?? 92;
  const color = options.color ?? '#f7e7c2';
  const glow = options.glow ?? 'rgba(247, 200, 120, 0.55)';
  const weight = options.weight ?? 600;
  const spacing = options.letterSpacing ?? 2;
  const align = options.align ?? 'center';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context == null) {
    throw new Error('2D canvas context unavailable; cannot build text textures.');
  }
  context.clearRect(0, 0, width, height);

  if (options.background != null) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, width, height);
  }

  context.textBaseline = 'middle';
  context.textAlign = align;
  context.font = `${weight} ${fontSize}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  context.shadowColor = glow;
  context.shadowBlur = Math.round(fontSize * 0.35);
  context.fillStyle = color;

  const x = align === 'center' ? width / 2 : Math.round(fontSize * 0.4);
  context.fillText(text, x, height / 2 + fontSize * 0.03);

  // Letter spacing is not universally supported; draw a second, softer pass
  // for a slight halo that reads well against dark materials.
  context.shadowBlur = Math.round(fontSize * 0.6);
  context.globalAlpha = 0.45;
  context.fillText(text, x, height / 2 + fontSize * 0.03);
  context.globalAlpha = 1;

  const texture = canvasTexture(canvas);
  void spacing;
  return { texture, canvas };
}

/** Soft radial glow sprite used for dust motes, fireflies and light halos. */
export function createRadialTexture(
  inner = 'rgba(255, 244, 214, 1)',
  outer = 'rgba(255, 214, 140, 0)',
  size = 128,
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context == null) {
    throw new Error('2D canvas context unavailable; cannot build sprite textures.');
  }
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.35, inner.replace(/,\s*1\)$/, ', 0.65)'));
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return canvasTexture(canvas);
}

function canvasTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}
