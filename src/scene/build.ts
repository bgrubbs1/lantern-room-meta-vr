/**
 * The Lantern Room — procedural scene construction.
 *
 * Nothing here is downloaded: every mesh is generated from Three.js primitives
 * and every material is created by {@link RoomTheme}, so the experience has no
 * external art dependencies and stays a single static bundle.
 *
 * Coordinate conventions
 * ----------------------
 * - The seated player origin is (0, 0, 0) and the player faces −Z.
 * - The table top is at y ≈ 0.72 m; all mechanisms sit in the comfortable
 *   hands-first reach band in front of the player (no locomotion).
 * - Grabbable roots are IWSDK entities (created with `createTransformEntity`),
 *   so their transforms are ECS-synced and the built-in grab system can drive
 *   them directly. Static decoration is plain Three.js under one entity.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Entity,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  OneHandGrabbable,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  RingGeometry,
  DirectionalLight,
  HemisphereLight,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type World,
} from '@iwsdk/core';
import { createRadialTexture, createTextTexture } from '../lib/canvas-text.js';
import type { LanternPuzzle } from '../puzzle/state.js';
import { RoomTheme } from './theme.js';

/** Layout constants shared by the builder and the per-frame room logic. */
export const LAYOUT = {
  playerOrigin: new Vector3(0, 0, 0),
  table: {
    center: new Vector3(0, 0, -0.64),
    topY: 0.72,
    radius: 0.44,
    thickness: 0.05,
  },
  lantern: new Vector3(0, 0.72, -0.56),
  dial: new Vector3(-0.19, 0.732, -0.47),
  dialRingRadii: [0.08, 0.125, 0.17] as const,
  drawerClosed: new Vector3(0.185, 0.62, -0.34),
  drawerTravel: 0.14,
  orrery: new Vector3(0.2, 0.72, -0.74),
  planetHomes: [
    new Vector3(0.08, 0.735, -0.5),
    new Vector3(0.19, 0.735, -0.45),
    new Vector3(0.3, 0.735, -0.5),
  ] as const,
  settings: new Vector3(-0.27, 0.8, -0.58),
  hint: new Vector3(0, 1.28, -0.62),
  floorRadius: 2.4,
  columnRadius: 2.15,
} as const;

export const TARGET_ANGLES = [-2.618, 0.733, 2.06] as const;
/** Orbit slot angles (radians) and radii for the orrery. */
export const ORBIT_SLOTS = [
  { angle: Math.PI * 1.18, radius: 0.1 },
  { angle: Math.PI * 1.82, radius: 0.135 },
  { angle: Math.PI * 0.52, radius: 0.17 },
] as const;


export interface DialRingView {
  index: number;
  entity: Entity;
  group: Object3D;
  locked: boolean;
  wasGrabbed: boolean;
}

export interface DrawerView {
  entity: Entity;
  group: Object3D;
  tray: Object3D;
  knob: Object3D;
  boltEntity: Entity;
  boltGroup: Object3D;
  boltEnabled: boolean;
  wasGrabbed: boolean;
  boltWasGrabbed: boolean;
  revealed: boolean;
  solvedLocked: boolean;
}

export interface PlanetView {
  id: string;
  entity: Entity;
  mesh: Object3D;
  home: Vector3;
  targetSlot: number;
  locked: boolean;
  wasGrabbed: boolean;
  tween: { from: Vector3; to: Vector3; t: number; duration: number } | undefined;
}

export interface OrreryView {
  group: Object3D;
  planets: PlanetView[];
  slots: Array<{ index: number; position: Vector3; cradle: Mesh }>;
  slotGlowMaterials: MeshStandardMaterial[];
}

export interface LanternView {
  entity: Entity;
  group: Object3D;
  core: Mesh;
  coreMaterial: MeshStandardMaterial;
  petals: Object3D[];
  cap: Object3D;
  gems: Array<{ mesh: Mesh; material: MeshStandardMaterial }>;
  light: PointLight;
  halo: Mesh;
  finalT: number;
  finalActive: boolean;
}

export interface SettingsButtonView {
  id: 'contrast' | 'motion' | 'gaze' | 'reset';
  entity: Entity;
  knob: Object3D;
  indicator: Mesh;
  indicatorMaterial: MeshStandardMaterial;
  wasGrabbed: boolean;
}

export interface FirefliesView {
  points: Points;
  positions: Float32Array;
  velocities: Float32Array;
  material: PointsMaterial;
  active: boolean;
  t: number;
}

export interface HintView {
  group: Group;
  mesh: Mesh;
  texture: ReturnType<typeof createTextTexture>['texture'];
  text: string;
}

export interface DustView {
  points: Points;
  positions: Float32Array;
  speeds: Float32Array;
  material: PointsMaterial;
}

export interface RoomScene {
  rootEntity: Entity;
  root: Object3D;
  theme: RoomTheme;
  lights: {
    lantern: PointLight;
    moon: import('@iwsdk/core').DirectionalLight;
    ambient: import('@iwsdk/core').HemisphereLight;
  };
  staticMaterials: {
    floor: MeshStandardMaterial;
    star: PointsMaterial;
    moon: MeshBasicMaterial;
  };
  dial: { center: Vector3; rings: DialRingView[]; targetLines: Object3D[] };
  drawer: DrawerView;
  orrery: OrreryView;
  lantern: LanternView;
  settings: { group: Object3D; buttons: SettingsButtonView[] };
  fireflies: FirefliesView;
  dust: DustView;
  hint: HintView;
  reticle: { group: Object3D; ring: Mesh; material: MeshBasicMaterial; label: Mesh };
  stars: Points;
  moon: Mesh;
}

function addMesh(
  parent: Object3D,
  geometry: import('@iwsdk/core').BufferGeometry,
  material: import('@iwsdk/core').Material,
  position?: Vector3,
  rotation?: [number, number, number],
): Mesh {
  const mesh = new Mesh(geometry, material);
  if (position != null) {
    mesh.position.copy(position);
  }
  if (rotation != null) {
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  }
  parent.add(mesh);
  return mesh;
}

function glowSpriteTexture(): ReturnType<typeof createRadialTexture> {
  return createRadialTexture(
    'rgba(255, 236, 190, 1)',
    'rgba(255, 170, 80, 0)',
    128,
  );
}

/** Build the whole room and return handles used by the frame loop. */
export function buildRoomScene(
  world: World,
  theme: RoomTheme,
  puzzle: LanternPuzzle,
): RoomScene {
  const rootGroup = new Group();
  rootGroup.name = 'LanternRoom';
  const rootEntity = world.createTransformEntity(rootGroup);
  const root = rootGroup;

  const palette = theme.palette;

  // ----------------------------------------------------------- materials ---
  const floorMaterial = theme.standard(0x1c1712, { roughness: 0.95, metalness: 0.02 }, 0x050609);
  const woodTopMaterial = theme.standard(0x3b2a1b, { roughness: 0.55, metalness: 0.05 }, 0x3d2f20);
  const woodEdgeMaterial = theme.standard(0x271b11, { roughness: 0.8 }, 0x161006);
  const brassMaterial = theme.standard(0xa87a42, { roughness: 0.32, metalness: 0.85 }, 0xc79a52);
  const brassBrightMaterial = theme.standard(
    0xe6bd76,
    { roughness: 0.24, metalness: 0.9, emissive: 0x3a2408, emissiveIntensity: 0.4 },
    0xfff0c0,
  );
  const ironMaterial = theme.standard(0x2e2b31, { roughness: 0.6, metalness: 0.55 }, 0x0d0e12);
  const feltMaterial = theme.standard(0x4a1f24, { roughness: 0.98 }, 0x5c1218);
  const glassMaterial = theme.standard(
    0x2a4c66,
    {
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.24,
      side: 2,
      emissive: 0x224466,
      emissiveIntensity: 0.35,
    },
    0x14334d,
  );
  const runeMaterial = theme.standard(
    0xffd9a0,
    { roughness: 0.3, metalness: 0.3, emissive: 0xffd9a0, emissiveIntensity: 1.6 },
    0xfff6d8,
  );
  const runeDimMaterial = theme.standard(
    0x6b5a3c,
    { roughness: 0.5, metalness: 0.2, emissive: 0x5a4522, emissiveIntensity: 0.35 },
    0x7a6647,
  );
  const stoneMaterial = theme.standard(0x272229, { roughness: 0.9 }, 0x0a0b0f);
  const starMaterial = new PointsMaterial({
    color: 0xcfd9ff,
    size: 0.055,
    sizeAttenuation: true,
    map: glowSpriteTexture(),
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const moonMaterial = new MeshBasicMaterial({ color: 0xdfe8ff, toneMapped: false });
  const glowMaterial = new MeshBasicMaterial({
    color: 0x574779,
    transparent: true,
    opacity: 0.35,
    blending: AdditiveBlending,
    depthWrite: false,
    side: 2,
    toneMapped: false,
  });
  const invisibleHitMaterial = new MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  // ------------------------------------------------------------ lighting ---
  const ambient = new HemisphereLight(0x4a4d78, 0x0d0a08, 0.75);
  root.add(ambient);

  const moon = new DirectionalLight(0x9fb8ff, 0.55);
  moon.position.set(-2.2, 3.4, 2.2);
  moon.castShadow = false;
  root.add(moon);

  const lanternLight = new PointLight(0xffb46a, 1.1, 4.2, 2);
  lanternLight.position.copy(LAYOUT.lantern).add(new Vector3(0, 0.16, 0));
  lanternLight.castShadow = false;
  root.add(lanternLight);

  const warmFill = new PointLight(0xffc98a, 0.7, 3.6, 2);
  warmFill.position.set(0.35, 1.45, -0.35);
  root.add(warmFill);

  theme.onPaletteChange((active) => {
    floorMaterial.color.setHex(active.floor);
    woodTopMaterial.color.setHex(active.woodTop);
    woodEdgeMaterial.color.setHex(active.woodEdge);
    brassMaterial.color.setHex(active.brass);
    brassBrightMaterial.color.setHex(active.brassBright);
    feltMaterial.color.setHex(active.felt);
    runeMaterial.emissive.setHex(active.rune);
    starMaterial.color.setHex(active.star);
    ambient.intensity = theme.isHighContrast ? 0.95 : 0.75;
    moon.intensity = theme.isHighContrast ? 0.9 : 0.65;
    glowMaterial.color.setHex(active.glowSoft);
  });

  // -------------------------------------------------------------- floor ---
  addMesh(
    root,
    new CircleGeometry(LAYOUT.floorRadius, 64),
    floorMaterial,
    new Vector3(0, 0.001, 0),
    [-Math.PI / 2, 0, 0],
  );
  const floorRing = addMesh(
    root,
    new TorusGeometry(LAYOUT.floorRadius * 0.72, 0.012, 8, 72),
    brassMaterial,
    new Vector3(0, 0.008, 0),
    [-Math.PI / 2, 0, 0],
  );
  floorRing.receiveShadow = false;

  // Star dome + moon.
  const domeGeometry = new SphereGeometry(9, 32, 24);
  const domeMaterial = new MeshBasicMaterial({
    color: 0x0b0a18,
    side: 1, // BackSide
    toneMapped: false,
  });
  addMesh(root, domeGeometry, domeMaterial, new Vector3(0, 0, 0));
  theme.onPaletteChange((active) => {
    domeMaterial.color.setHex(active.floor === 0x050609 ? 0x020307 : 0x0b0a18);
  });

  const starPositions: number[] = [];
  const starColors: number[] = [];
  let seed = 20261027;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let index = 0; index < 900; index += 1) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(1 - random() * 1.35);
    const radius = 8.4;
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    if (y < -0.6) {
      continue;
    }
    starPositions.push(x, y, z);
    const warmth = random();
    starColors.push(0.72 + warmth * 0.28, 0.76 + warmth * 0.2, 1);
  }
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute('position', new Float32BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('color', new Float32BufferAttribute(starColors, 3));
  starMaterial.vertexColors = true;
  const stars = new Points(starGeometry, starMaterial);
  root.add(stars);

  const moonMesh = addMesh(
    root,
    new SphereGeometry(0.34, 24, 18),
    moonMaterial,
    new Vector3(-2.6, 4.1, -5.4),
  );
  const moonGlow = addMesh(
    root,
    new CircleGeometry(1.15, 32),
    glowMaterial,
    new Vector3(-2.6, 4.1, -5.35),
  );
  moonGlow.lookAt(0, 1.2, 0);

  // Columns + top ring for the observatory feel.
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(angle) * LAYOUT.columnRadius;
    const z = Math.sin(angle) * LAYOUT.columnRadius;
    addMesh(
      root,
      new CylinderGeometry(0.06, 0.07, 1.9, 12),
      stoneMaterial,
      new Vector3(x, 0.95, z),
    );
    addMesh(
      root,
      new BoxGeometry(0.18, 0.05, 0.18),
      brassMaterial,
      new Vector3(x, 1.92, z),
    );
  }
  addMesh(
    root,
    new TorusGeometry(LAYOUT.columnRadius, 0.035, 8, 64),
    stoneMaterial,
    new Vector3(0, 1.95, 0),
    [-Math.PI / 2, 0, 0],
  );

  // -------------------------------------------------------------- table ---
  addMesh(
    root,
    new CylinderGeometry(LAYOUT.table.radius, LAYOUT.table.radius, LAYOUT.table.thickness, 48),
    woodTopMaterial,
    new Vector3(LAYOUT.table.center.x, LAYOUT.table.topY - LAYOUT.table.thickness / 2, LAYOUT.table.center.z),
  );
  addMesh(
    root,
    new TorusGeometry(LAYOUT.table.radius - 0.005, 0.014, 8, 64),
    brassMaterial,
    new Vector3(LAYOUT.table.center.x, LAYOUT.table.topY - LAYOUT.table.thickness / 2, LAYOUT.table.center.z),
    [-Math.PI / 2, 0, 0],
  );
  addMesh(
    root,
    new CylinderGeometry(0.07, 0.1, 0.62, 16),
    woodEdgeMaterial,
    new Vector3(LAYOUT.table.center.x, 0.36, LAYOUT.table.center.z),
  );
  addMesh(
    root,
    new ConeGeometry(0.28, 0.06, 24),
    woodEdgeMaterial,
    new Vector3(LAYOUT.table.center.x, 0.03, LAYOUT.table.center.z),
    [Math.PI, 0, 0],
  );
  // Engraved inlay ring around the whole table.
  addMesh(
    root,
    new TorusGeometry(LAYOUT.table.radius - 0.06, 0.004, 6, 64),
    runeDimMaterial,
    new Vector3(LAYOUT.table.center.x, LAYOUT.table.topY + 0.001, LAYOUT.table.center.z),
    [-Math.PI / 2, 0, 0],
  );

  // Recessed drawer housing on the front-right of the table.
  addMesh(
    root,
    new BoxGeometry(0.34, 0.16, 0.28),
    woodEdgeMaterial,
    new Vector3(LAYOUT.drawerClosed.x, 0.6, LAYOUT.drawerClosed.z - 0.06),
  );

  // ---------------------------------------------------------- the lantern ---
  const lanternGroup = new Group();
  lanternGroup.name = 'Lantern';
  lanternGroup.position.copy(LAYOUT.lantern);
  const lanternEntity = world.createTransformEntity(lanternGroup, { parent: rootEntity });

  addMesh(lanternGroup, new CylinderGeometry(0.11, 0.12, 0.035, 24), brassMaterial, new Vector3(0, 0.018, 0));
  addMesh(lanternGroup, new CylinderGeometry(0.055, 0.075, 0.05, 20), brassMaterial, new Vector3(0, 0.06, 0));
  const coreMaterial = theme.standard(
    0xffdca6,
    { roughness: 0.3, metalness: 0.1, emissive: 0xffdca6, emissiveIntensity: 0.5 },
    0xfff2cf,
  );
  const core = addMesh(
    lanternGroup,
    new IcosahedronGeometry(0.045, 1),
    coreMaterial,
    new Vector3(0, 0.18, 0),
  );
  const haloMaterial = new MeshBasicMaterial({
    color: 0xffc27a,
    transparent: true,
    opacity: 0.22,
    blending: AdditiveBlending,
    depthWrite: false,
    side: 2,
    toneMapped: false,
  });
  const halo = addMesh(lanternGroup, new SphereGeometry(0.2, 20, 14), haloMaterial, new Vector3(0, 0.18, 0));
  halo.visible = false;

  const petalPivots: Object3D[] = [];
  for (let index = 0; index < 3; index += 1) {
    const pivot = new Group();
    pivot.position.set(0, 0.085, 0);
    pivot.rotation.y = (index / 3) * Math.PI * 2;
    lanternGroup.add(pivot);
    const pane = new Mesh(new BoxGeometry(0.1, 0.19, 0.008), glassMaterial);
    pane.position.set(0, 0.095, 0.075);
    pivot.add(pane);
    const frame = new Mesh(new BoxGeometry(0.104, 0.02, 0.012), brassMaterial);
    frame.position.set(0, 0.19, 0.075);
    pivot.add(frame);
    const foot = new Mesh(new BoxGeometry(0.104, 0.02, 0.012), brassMaterial);
    foot.position.set(0, 0.0, 0.075);
    pivot.add(foot);
    petalPivots.push(pivot);
  }

  const capGroup = new Group();
  capGroup.position.set(0, 0.29, 0);
  lanternGroup.add(capGroup);
  addMesh(capGroup, new ConeGeometry(0.11, 0.07, 16), brassMaterial, new Vector3(0, 0.035, 0));
  addMesh(capGroup, new TorusGeometry(0.035, 0.008, 6, 20), brassBrightMaterial, new Vector3(0, 0.1, 0), [Math.PI / 2, 0, 0]);
  addMesh(capGroup, new SphereGeometry(0.016, 12, 10), brassBrightMaterial, new Vector3(0, 0.08, 0));

  // Three progress gems around the lantern base (one per mechanism).
  const gems: LanternView['gems'] = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * Math.PI * 2 + Math.PI / 2;
    const gemMaterial = theme.standard(
      palette.warm,
      { roughness: 0.2, metalness: 0.4, emissive: palette.warm, emissiveIntensity: 0.05 },
      palette.warm,
    );
    const gem = addMesh(
      lanternGroup,
      new OctahedronGeometry(0.016, 0),
      gemMaterial,
      new Vector3(Math.cos(angle) * 0.105, 0.038, Math.sin(angle) * 0.105),
    );
    gems.push({ mesh: gem, material: gemMaterial });
  }

  // ------------------------------------------------------ constellation dial ---
  const dialGroup = new Group();
  dialGroup.name = 'ConstellationDial';
  dialGroup.position.copy(LAYOUT.dial);
  root.add(dialGroup);
  addMesh(dialGroup, new CylinderGeometry(0.21, 0.22, 0.012, 40), ironMaterial, new Vector3(0, -0.006, 0));
  addMesh(dialGroup, new CylinderGeometry(0.032, 0.04, 0.02, 16), brassMaterial, new Vector3(0, 0.012, 0));
  addMesh(dialGroup, new SphereGeometry(0.012, 12, 10), runeMaterial, new Vector3(0, 0.026, 0));

  const targetLines: Object3D[] = [];
  for (let index = 0; index < 3; index += 1) {
    const target = TARGET_ANGLES[index] ?? 0;
    const radius = LAYOUT.dialRingRadii[index] ?? 0.1;
    const lineGroup = new Group();
    lineGroup.rotation.y = target;
    dialGroup.add(lineGroup);
    const length = radius + 0.045;
    const line = new Mesh(new BoxGeometry(0.0035, 0.0025, length), runeDimMaterial);
    line.position.set(0, 0.003, length / 2 + 0.025);
    lineGroup.add(line);
    const starGlyph = new Mesh(new OctahedronGeometry(0.011, 0), runeMaterial.clone());
    starGlyph.position.set(0, 0.004, length + 0.025);
    lineGroup.add(starGlyph);
    targetLines.push(lineGroup);
  }

  const dialRings: DialRingView[] = [];
  for (let index = 0; index < 3; index += 1) {
    const radius = LAYOUT.dialRingRadii[index] ?? 0.1;
    const ringGroup = new Group();
    ringGroup.position.copy(LAYOUT.dial).add(new Vector3(0, 0.006 + index * 0.006, 0));
    const ringEntity = world.createTransformEntity(ringGroup, { parent: rootEntity });

    const ringMesh = new Mesh(new TorusGeometry(radius, 0.008, 10, 48), brassMaterial);
    ringMesh.rotation.x = -Math.PI / 2;
    ringGroup.add(ringMesh);
    // A wider, invisible annulus makes the thin ring comfortable to pinch.
    const hitPad = new Mesh(
      new RingGeometry(radius - 0.026, radius + 0.026, 40),
      invisibleHitMaterial,
    );
    hitPad.rotation.x = -Math.PI / 2;
    ringGroup.add(hitPad);

    const runeMarker = new Mesh(new OctahedronGeometry(0.014, 0), runeMaterial);
    runeMarker.position.set(radius, 0.008, 0);
    ringGroup.add(runeMarker);
    const markerLine = new Mesh(new BoxGeometry(0.002, 0.002, 0.03), runeMaterial);
    markerLine.position.set(radius - 0.016, 0.008, 0);
    ringGroup.add(markerLine);

    // Register the grabbable only once the handle has a raycastable subtree.
    ringEntity.addComponent(OneHandGrabbable, {
      rotate: true,
      translate: false,
      rotateMin: [0, -Math.PI, 0],
      rotateMax: [0, Math.PI, 0],
    });

    dialRings.push({
      index,
      entity: ringEntity,
      group: ringGroup,
      locked: false,
      wasGrabbed: false,
    });
  }

  // --------------------------------------------------------------- drawer ---
  const drawerGroup = new Group();
  drawerGroup.name = 'Drawer';
  drawerGroup.position.copy(LAYOUT.drawerClosed);
  const drawerEntity = world.createTransformEntity(drawerGroup, { parent: rootEntity });

  const tray = new Group();
  drawerGroup.add(tray);
  addMesh(tray, new BoxGeometry(0.3, 0.016, 0.24), feltMaterial, new Vector3(0, -0.02, 0.02));
  addMesh(tray, new BoxGeometry(0.3, 0.03, 0.016), woodEdgeMaterial, new Vector3(0, 0.0, 0.14));
  addMesh(tray, new BoxGeometry(0.3, 0.03, 0.016), woodEdgeMaterial, new Vector3(0, 0.0, -0.1));
  addMesh(tray, new BoxGeometry(0.016, 0.03, 0.24), woodEdgeMaterial, new Vector3(0.15, 0.0, 0.02));
  addMesh(tray, new BoxGeometry(0.016, 0.03, 0.24), woodEdgeMaterial, new Vector3(-0.15, 0.0, 0.02));
  // Drawer face + knob stay proud of the apron so they are easy to pinch.
  addMesh(tray, new BoxGeometry(0.32, 0.1, 0.02), woodTopMaterial, new Vector3(0, 0.02, 0.155));
  const drawerKnob = addMesh(
    tray,
    new TorusGeometry(0.022, 0.008, 8, 20),
    brassBrightMaterial,
    new Vector3(0, 0.02, 0.17),
    [Math.PI / 2, 0, 0],
  );
  const knobHit = new Mesh(new BoxGeometry(0.09, 0.05, 0.03), invisibleHitMaterial);
  knobHit.position.set(0, 0.02, 0.17);
  tray.add(knobHit);

  // Handle constraints are absolute in the parent's local space (root is at
  // the origin), so the box pins X/Y and only allows the +Z slide. Registered
  // after the tray meshes so the grab handle has a raycastable subtree.
  drawerEntity.addComponent(OneHandGrabbable, {
    rotate: false,
    translate: true,
    translateMin: [LAYOUT.drawerClosed.x, LAYOUT.drawerClosed.y, LAYOUT.drawerClosed.z],
    translateMax: [
      LAYOUT.drawerClosed.x,
      LAYOUT.drawerClosed.y,
      LAYOUT.drawerClosed.z + LAYOUT.drawerTravel,
    ],
  });

  // Hidden bolt inside the drawer — enabled once the drawer is open.
  const boltGroup = new Group();
  boltGroup.position.set(-0.1, 0.022, 0.02);
  const boltEntity = world.createTransformEntity(boltGroup, { parent: drawerEntity });
  addMesh(boltGroup, new BoxGeometry(0.09, 0.014, 0.018), brassBrightMaterial, new Vector3(0, 0, 0));
  addMesh(boltGroup, new CylinderGeometry(0.008, 0.008, 0.02, 10), brassMaterial, new Vector3(0, 0.01, 0), [0, 0, Math.PI / 2]);
  const boltHit = new Mesh(new BoxGeometry(0.1, 0.04, 0.04), invisibleHitMaterial);
  boltHit.position.set(0.02, 0.005, 0.015);
  boltGroup.add(boltHit);

  const drawer: DrawerView = {
    entity: drawerEntity,
    group: drawerGroup,
    tray,
    knob: drawerKnob,
    boltEntity,
    boltGroup,
    boltEnabled: false,
    wasGrabbed: false,
    boltWasGrabbed: false,
    revealed: false,
    solvedLocked: false,
  };

  // --------------------------------------------------------------- orrery ---
  const orreryGroup = new Group();
  orreryGroup.name = 'Orrery';
  orreryGroup.position.copy(LAYOUT.orrery);
  root.add(orreryGroup);
  addMesh(orreryGroup, new CylinderGeometry(0.05, 0.07, 0.03, 20), ironMaterial, new Vector3(0, 0.015, 0));
  addMesh(orreryGroup, new CylinderGeometry(0.012, 0.012, 0.14, 10), brassMaterial, new Vector3(0, 0.09, 0));
  const sunMaterial = theme.standard(
    0xffc46e,
    { roughness: 0.2, metalness: 0.2, emissive: 0xffb35c, emissiveIntensity: 1.4 },
    0xffd27a,
  );
  addMesh(orreryGroup, new SphereGeometry(0.028, 20, 16), sunMaterial, new Vector3(0, 0.15, 0));

  const slotAngles = [Math.PI * 0.52, Math.PI * 1.18, Math.PI * 1.82];
  const slots: OrreryView['slots'] = [];
  const slotGlowMaterials: MeshStandardMaterial[] = [];
  for (let index = 0; index < 3; index += 1) {
    const orbitRadius = ORBIT_SLOTS[index]?.radius ?? 0.12;
    addMesh(
      orreryGroup,
      new TorusGeometry(orbitRadius, 0.0025, 6, 48),
      brassMaterial,
      new Vector3(0, 0.14, 0),
      [-Math.PI / 2, 0, 0],
    );
    const angle = slotAngles[index] ?? 0;
    const local = new Vector3(
      Math.cos(angle) * orbitRadius,
      0.145,
      Math.sin(angle) * orbitRadius,
    );
    const cradleMaterial = theme.standard(
      0x6b5a3c,
      { roughness: 0.45, metalness: 0.5, emissive: 0x000000, emissiveIntensity: 0 },
      0x8a7447,
    );
    slotGlowMaterials.push(cradleMaterial);
    const spokes = new Mesh(new CylinderGeometry(0.002, 0.002, orbitRadius, 6), brassMaterial);
    spokes.position.set(
      (Math.cos(angle) * orbitRadius) / 2,
      0.14,
      (Math.sin(angle) * orbitRadius) / 2,
    );
    spokes.rotation.z = Math.PI / 2;
    spokes.rotation.y = -angle;
    orreryGroup.add(spokes);
    const cradle = addMesh(
      orreryGroup,
      new TorusGeometry(0.035, 0.005, 8, 24),
      cradleMaterial,
      local,
      [-Math.PI / 2, 0, 0],
    );
    slots.push({
      index,
      position: LAYOUT.orrery.clone().add(new Vector3(local.x, local.y, local.z)),
      cradle,
    });
  }

  const planetColors = [palette.ember, palette.brine, palette.moss];
  const planets: PlanetView[] = [];
  puzzle.config.orrery.planets.forEach((planet, index) => {
    const home = LAYOUT.planetHomes[index] ?? LAYOUT.planetHomes[0] ?? new Vector3();
    const group = new Group();
    group.position.copy(home);
    const entity = world.createTransformEntity(group, { parent: rootEntity });
    const material = theme.standard(
      planetColors[index] ?? palette.ember,
      {
        roughness: 0.35,
        metalness: 0.15,
        emissive: planetColors[index] ?? palette.ember,
        emissiveIntensity: 0.18,
      },
      planetColors[index],
    );
    const mesh = addMesh(group, new SphereGeometry(0.026, 20, 16), material, new Vector3(0, 0.026, 0));
    const belt = new Mesh(new TorusGeometry(0.036, 0.004, 6, 24), brassMaterial);
    belt.rotation.x = -Math.PI / 2 + 0.3;
    mesh.add(belt);
    const hit = new Mesh(new SphereGeometry(0.05, 12, 10), invisibleHitMaterial);
    hit.position.set(0, 0.026, 0);
    group.add(hit);
    entity.addComponent(OneHandGrabbable, {
      rotate: false,
      translate: true,
      translateMin: [-0.12, 0.7, -0.95],
      translateMax: [0.5, 0.94, -0.26],
    });
    // Socket dish on the table showing where the planet starts.
    addMesh(
      root,
      new CylinderGeometry(0.032, 0.028, 0.012, 16),
      brassMaterial,
      new Vector3(home.x, LAYOUT.table.topY + 0.006, home.z),
    );
    planets.push({
      id: planet.id,
      entity,
      mesh: group,
      home: home.clone(),
      targetSlot: planet.targetSlot,
      locked: false,
      wasGrabbed: false,
      tween: undefined,
    });
  });

  const orrery: OrreryView = {
    group: orreryGroup,
    planets,
    slots,
    slotGlowMaterials,
  };

  // ------------------------------------------------------------- settings ---
  const settingsGroup = new Group();
  settingsGroup.name = 'Settings';
  settingsGroup.position.copy(LAYOUT.settings);
  settingsGroup.rotation.set(-0.34, 0.18, 0);
  root.add(settingsGroup);
  addMesh(settingsGroup, new BoxGeometry(0.3, 0.21, 0.012), ironMaterial, new Vector3(0, 0, 0));
  addMesh(settingsGroup, new BoxGeometry(0.31, 0.012, 0.016), brassMaterial, new Vector3(0, 0.105, 0.002));
  const settingsTitle = createTextTexture('SETTINGS', {
    width: 512,
    height: 128,
    fontSize: 58,
    color: '#f7e7c2',
    glow: 'rgba(200,160,90,0.4)',
  });
  const titlePlane = new Mesh(
    new PlaneGeometry(0.22, 0.055),
    new MeshBasicMaterial({ map: settingsTitle.texture, transparent: true, depthWrite: false }),
  );
  titlePlane.position.set(0, 0.072, 0.009);
  settingsGroup.add(titlePlane);

  const buttonDefs: Array<{
    id: SettingsButtonView['id'];
    label: string;
    x: number;
    y: number;
  }> = [
    { id: 'contrast', label: 'CONTRAST', x: -0.072, y: 0.018 },
    { id: 'motion', label: 'GENTLE', x: 0.072, y: 0.018 },
    { id: 'gaze', label: 'GAZE', x: -0.072, y: -0.052 },
    { id: 'reset', label: 'RESET', x: 0.072, y: -0.052 },
  ];
  const settingsButtons: SettingsButtonView[] = [];
  for (const def of buttonDefs) {
    const local = new Vector3(def.x, def.y, 0.012);
    const worldPosition = settingsGroup.localToWorld(local.clone());
    const buttonGroup = new Group();
    buttonGroup.position.copy(worldPosition);
    // Counter-rotate the button so its text stays parallel to the board.
    buttonGroup.rotation.set(-0.34, 0.18, 0);
    const buttonEntity = world.createTransformEntity(buttonGroup, { parent: rootEntity });
    addMesh(buttonGroup, new CylinderGeometry(0.024, 0.026, 0.008, 16), ironMaterial, new Vector3(0, -0.002, 0), [Math.PI / 2, 0, 0]);
    const knob = addMesh(
      buttonGroup,
      new CylinderGeometry(0.011, 0.013, 0.016, 14),
      brassBrightMaterial,
      new Vector3(0, 0.008, 0.012),
      [Math.PI / 2, 0, 0],
    );
    const hit = new Mesh(new BoxGeometry(0.07, 0.06, 0.03), invisibleHitMaterial);
    hit.position.set(0, 0.006, 0.014);
    buttonGroup.add(hit);
    const indicatorMaterial = theme.standard(
      0x3b2a1b,
      { roughness: 0.4, metalness: 0.2, emissive: 0x000000, emissiveIntensity: 0 },
      0x3d2f20,
    );
    const indicator = addMesh(
      buttonGroup,
      new SphereGeometry(0.0055, 10, 8),
      indicatorMaterial,
      new Vector3(0.0, -0.026, 0.012),
    );
    const label = createTextTexture(def.label, {
      width: 256,
      height: 96,
      fontSize: 40,
      color: '#d9c8a2',
      glow: 'rgba(120,100,60,0.35)',
    });
    const labelPlane = new Mesh(
      new PlaneGeometry(0.085, 0.032),
      new MeshBasicMaterial({ map: label.texture, transparent: true, depthWrite: false }),
    );
    labelPlane.position.set(0, 0.032, 0.011);
    buttonGroup.add(labelPlane);
    buttonEntity.addComponent(OneHandGrabbable, {
      rotate: false,
      translate: false,
    });
    settingsButtons.push({
      id: def.id,
      entity: buttonEntity,
      knob,
      indicator,
      indicatorMaterial,
      wasGrabbed: false,
    });
  }

  // -------------------------------------------------------------- hint card ---
  const hintGroup = new Group();
  hintGroup.position.copy(LAYOUT.hint);
  root.add(hintGroup);
  const hintTexture = createTextTexture('Pinch a ring and turn it to a star line', {
    width: 1024,
    height: 160,
    fontSize: 64,
    color: '#f6e7c8',
    glow: 'rgba(255,190,110,0.5)',
  });
  const hintMesh = new Mesh(
    new PlaneGeometry(0.52, 0.081),
    new MeshBasicMaterial({
      map: hintTexture.texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  hintGroup.add(hintMesh);
  const hintView: HintView = {
    group: hintGroup,
    mesh: hintMesh,
    texture: hintTexture.texture,
    text: 'Pinch a ring and turn it to a star line',
  };

  // ---------------------------------------------------------------- dust ---
  const dustCount = 240;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustSpeeds = new Float32Array(dustCount);
  for (let index = 0; index < dustCount; index += 1) {
    dustPositions[index * 3] = (random() - 0.5) * 2.4;
    dustPositions[index * 3 + 1] = 0.15 + random() * 1.8;
    dustPositions[index * 3 + 2] = -1.9 + random() * 2.6;
    dustSpeeds[index] = 0.008 + random() * 0.02;
  }
  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute('position', new Float32BufferAttribute(dustPositions, 3));
  const dustMaterial = new PointsMaterial({
    color: 0xffdca6,
    size: 0.008,
    sizeAttenuation: true,
    map: glowSpriteTexture(),
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const dustPoints = new Points(dustGeometry, dustMaterial);
  dustPoints.frustumCulled = false;
  root.add(dustPoints);

  // ------------------------------------------------------------ fireflies ---
  const fireflyCount = 96;
  const fireflyPositions = new Float32Array(fireflyCount * 3);
  const fireflyVelocities = new Float32Array(fireflyCount * 3);
  for (let index = 0; index < fireflyCount; index += 1) {
    fireflyPositions[index * 3] = LAYOUT.lantern.x;
    fireflyPositions[index * 3 + 1] = LAYOUT.lantern.y + 0.2;
    fireflyPositions[index * 3 + 2] = LAYOUT.lantern.z;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(1 - random() * 1.4);
    const speed = 0.12 + random() * 0.24;
    fireflyVelocities[index * 3] = Math.sin(phi) * Math.cos(theta) * speed;
    fireflyVelocities[index * 3 + 1] = (0.15 + random() * 0.35) * speed * 2.2;
    fireflyVelocities[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
  }
  const fireflyGeometry = new BufferGeometry();
  fireflyGeometry.setAttribute('position', new Float32BufferAttribute(fireflyPositions, 3));
  const fireflyMaterial = new PointsMaterial({
    color: 0xffe6a8,
    size: 0.026,
    sizeAttenuation: true,
    map: glowSpriteTexture(),
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const fireflyPoints = new Points(fireflyGeometry, fireflyMaterial);
  fireflyPoints.frustumCulled = false;
  fireflyPoints.visible = false;
  root.add(fireflyPoints);

  // ---------------------------------------------------------- gaze reticle ---
  const reticleGroup = new Group();
  reticleGroup.visible = false;
  root.add(reticleGroup);
  const reticleMaterial = new MeshBasicMaterial({
    color: 0x9fd0ff,
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
    side: 2,
    toneMapped: false,
  });
  const reticleRing = new Mesh(
    new RingGeometry(0.03, 0.037, 32),
    reticleMaterial,
  );
  reticleGroup.add(reticleRing);
  const reticleLabel = new Mesh(
    new PlaneGeometry(0.16, 0.025),
    new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0 }),
  );
  reticleGroup.add(reticleLabel);

  return {
    rootEntity,
    root,
    theme,
    lights: { lantern: lanternLight, moon, ambient },
    staticMaterials: {
      floor: floorMaterial,
      star: starMaterial,
      moon: moonMaterial,
    },
    dial: { center: LAYOUT.dial.clone(), rings: dialRings, targetLines },
    drawer,
    orrery,
    lantern: {
      entity: lanternEntity,
      group: lanternGroup,
      core,
      coreMaterial,
      petals: petalPivots,
      cap: capGroup,
      gems,
      light: lanternLight,
      halo,
      finalT: 0,
      finalActive: false,
    },
    settings: { group: settingsGroup, buttons: settingsButtons },
    fireflies: {
      points: fireflyPoints,
      positions: fireflyPositions,
      velocities: fireflyVelocities,
      material: fireflyMaterial,
      active: false,
      t: 0,
    },
    dust: { points: dustPoints, positions: dustPositions, speeds: dustSpeeds, material: dustMaterial },
    hint: hintView,
    reticle: { group: reticleGroup, ring: reticleRing, material: reticleMaterial, label: reticleLabel },
    stars,
    moon: moonMesh,
  };
}
