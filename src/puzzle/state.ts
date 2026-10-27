/**
 * The Lantern Room — pure puzzle state machine.
 *
 * This module deliberately has **no** dependency on IWSDK, Three.js or the DOM.
 * Renderer/system code mutates it through the API below, and the unit tests in
 * `tests/puzzle-state.test.ts` exercise it directly with `vitest`.
 *
 * Three mechanisms each unlock one third of the lantern:
 *   1. `dial`   — three concentric rings rotated to match a constellation.
 *   2. `drawer` — pull the drawer out, then slide its hidden bolt.
 *   3. `orrery` — place three planets into their correct orbit slots.
 *
 * When all three are solved the lantern opens (`opened: true`).
 */

export type MechanismId = 'dial' | 'drawer' | 'orrery';

export const MECHANISMS: readonly MechanismId[] = ['dial', 'drawer', 'orrery'];

export interface DialRingConfig {
  /** Target angle in radians for this ring. */
  readonly target: number;
  /** Human-readable name used by hints / accessibility narration. */
  readonly name: string;
}

export interface DrawerConfig {
  /** Pull distance that counts as fully open, in meters. */
  readonly openPull: number;
  /** Maximum pull distance, in meters. */
  readonly maxPull: number;
  /** Bolt travel that counts as released, in meters. */
  readonly boltOpen: number;
  /** Maximum bolt travel, in meters. */
  readonly maxBolt: number;
}

export interface OrreryPlanetConfig {
  readonly id: string;
  /** Orbit slot index that solves this planet. */
  readonly targetSlot: number;
  /** Slot index the planet starts in (its home socket). */
  readonly homeSlot: number;
}

export interface PuzzleConfig {
  readonly dial: { readonly rings: readonly DialRingConfig[] };
  readonly drawer: DrawerConfig;
  readonly orrery: { readonly planets: readonly OrreryPlanetConfig[] };
  /** Angular distance (radians) at which a ring snaps to its target. */
  readonly dialTolerance: number;
}

export const DEFAULT_PUZZLE_CONFIG: PuzzleConfig = {
  dial: {
    rings: [
      { target: -2.618, name: 'the Ember ring' }, // -150°
      { target: 0.733, name: 'the Tidal ring' }, // 42°
      { target: 2.06, name: 'the Warden ring' }, // 118°
    ],
  },
  drawer: {
    openPull: 0.11,
    maxPull: 0.15,
    boltOpen: 0.055,
    maxBolt: 0.07,
  },
  orrery: {
    planets: [
      { id: 'ember', targetSlot: 2, homeSlot: 0 },
      { id: 'brine', targetSlot: 0, homeSlot: 1 },
      { id: 'moss', targetSlot: 1, homeSlot: 2 },
    ],
  },
  dialTolerance: 0.14, // ~8° — generous enough for hand tracking
};

export type PlanetPlacement = 'correct' | 'wrong' | 'ignored';

export interface PuzzleSnapshot {
  readonly dial: {
    readonly angles: readonly number[];
    readonly targets: readonly number[];
    readonly aligned: readonly boolean[];
    readonly solved: boolean;
  };
  readonly drawer: {
    readonly pull: number;
    readonly open: boolean;
    readonly bolt: number;
    readonly boltReleased: boolean;
    readonly solved: boolean;
  };
  readonly orrery: {
    readonly slots: Readonly<Record<string, number>>;
    readonly solved: boolean;
  };
  readonly solvedCount: number;
  readonly lanternOpen: boolean;
  /** True while the finale animation should be playing. */
  readonly finale: boolean;
}

export interface PuzzleEvent {
  readonly type: 'mechanism-solved' | 'lantern-open' | 'reset' | 'planet-rejected';
  readonly mechanism?: MechanismId;
}

/** How far a single accessibility "assist" step moves a mechanism. */
export const ASSIST_DIAL_STEP = Math.PI / 6; // 30°
export const ASSIST_PULL_STEP = 0.045; // meters
export const ASSIST_BOLT_STEP = 0.03; // meters

const TWO_PI = Math.PI * 2;

/** Wrap an angle into (-π, π]. */
export function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) {
    throw new RangeError(`normalizeAngle received a non-finite angle: ${String(angle)}`);
  }
  const wrapped = ((angle + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
  return wrapped === -Math.PI ? Math.PI : wrapped;
}

/** Shortest signed rotation from `from` to `to`, in (-π, π]. */
export function angleDelta(from: number, to: number): number {
  return normalizeAngle(to - from);
}

/** True when two angles are within `tolerance` radians of each other. */
export function anglesMatch(a: number, b: number, tolerance: number): boolean {
  if (tolerance < 0) {
    throw new RangeError('tolerance must be >= 0');
  }
  return Math.abs(angleDelta(a, b)) <= tolerance;
}

/** Append a rotation delta to an angle, returning a normalized result. */
export function addAngle(angle: number, delta: number): number {
  return normalizeAngle(angle + delta);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The Lantern Room puzzle. All state is mutated through intentions
 * (`rotateRing`, `pullDrawer`, `slideBolt`, `placePlanet`) so the renderer can
 * stay a dumb view of this model and the tests can drive it without a browser.
 */
export class LanternPuzzle {
  readonly config: PuzzleConfig;

  private angleValues: number[];
  private ringSolved: boolean[];
  private dialSolved = false;

  private pull = 0;
  private bolt = 0;
  private drawerSolved = false;

  private slots: Record<string, number>;
  private orrerySolved = false;

  private open = false;
  private readonly listeners = new Set<(event: PuzzleEvent) => void>();

  constructor(config: PuzzleConfig = DEFAULT_PUZZLE_CONFIG) {
    if (config.dial.rings.length !== 3) {
      throw new RangeError('The constellation dial must have exactly three rings.');
    }
    if (config.dialTolerance < 0) {
      throw new RangeError('dialTolerance must be >= 0.');
    }
    if (config.orrery.planets.length !== 3) {
      throw new RangeError('The orrery must have exactly three planets.');
    }
    this.config = config;
    this.angleValues = config.dial.rings.map(() => 0);
    this.ringSolved = config.dial.rings.map(() => false);
    this.slots = {};
    for (const planet of config.orrery.planets) {
      this.slots[planet.id] = planet.homeSlot;
    }
  }

  /** Subscribe to state-machine events. Returns an unsubscribe function. */
  subscribe(listener: (event: PuzzleEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: PuzzleEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // ---------------------------------------------------------------- dial ---

  ringAngles(): readonly number[] {
    return this.angleValues;
  }

  /**
   * Add a rotation delta to a dial ring. The renderer calls this every frame
   * while the user pinches and sweeps a ring; `snapDialIfClose` decides when
   * an aligned ring locks in.
   */
  rotateRing(index: number, delta: number): void {
    this.assertRingIndex(index);
    this.angleValues[index] = addAngle(this.angleValues[index] ?? 0, delta);
    this.ringSolved[index] = false;
    if (this.dialSolved) {
      this.dialSolved = false;
      this.open = false;
    }
  }

  /** Absolute setter, useful for assist mode and tests. */
  setRingAngle(index: number, angle: number): void {
    this.assertRingIndex(index);
    this.angleValues[index] = normalizeAngle(angle);
    this.ringSolved[index] = false;
    if (this.dialSolved) {
      this.dialSolved = false;
      this.open = false;
    }
  }

  ringAligned(index: number): boolean {
    this.assertRingIndex(index);
    const target = this.config.dial.rings[index]?.target ?? 0;
    return anglesMatch(this.angleValues[index] ?? 0, target, this.config.dialTolerance);
  }

  /**
   * When every ring is within tolerance, snap them exactly onto their targets
   * and mark the dial solved. Returns true only on the transition to solved.
   */
  snapDialIfClose(): boolean {
    if (this.dialSolved) {
      return false;
    }
    const aligned = this.config.dial.rings.map((ring, index) =>
      anglesMatch(this.angleValues[index] ?? 0, ring.target, this.config.dialTolerance),
    );
    if (!aligned.every(Boolean)) {
      return false;
    }
    this.angleValues = this.config.dial.rings.map((ring) => normalizeAngle(ring.target));
    this.ringSolved = this.config.dial.rings.map(() => true);
    this.dialSolved = true;
    this.emit({ type: 'mechanism-solved', mechanism: 'dial' });
    this.maybeOpenLantern();
    return true;
  }

  private assertRingIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.config.dial.rings.length) {
      throw new RangeError(`Invalid dial ring index: ${String(index)}`);
    }
  }

  // -------------------------------------------------------------- drawer ---

  /** Set the drawer pull distance in meters (clamped to configured travel). */
  pullDrawer(distance: number): void {
    this.pull = clamp(distance, 0, this.config.drawer.maxPull);
    this.updateDrawerSolved();
  }

  /** Slide the hidden bolt in meters (clamped to configured travel). */
  slideBolt(distance: number): void {
    this.bolt = clamp(distance, 0, this.config.drawer.maxBolt);
    this.updateDrawerSolved();
  }

  get drawerOpen(): boolean {
    return this.pull >= this.config.drawer.openPull;
  }

  get boltReleased(): boolean {
    return this.bolt >= this.config.drawer.boltOpen;
  }

  private updateDrawerSolved(): void {
    if (this.drawerSolved || !this.drawerOpen || !this.boltReleased) {
      return;
    }
    this.drawerSolved = true;
    this.emit({ type: 'mechanism-solved', mechanism: 'drawer' });
    this.maybeOpenLantern();
  }

  // -------------------------------------------------------------- orrery ---

  get planetSlots(): Readonly<Record<string, number>> {
    return this.slots;
  }

  /**
   * Drop a planet on a slot. Correct slots lock in; wrong slots are rejected
   * and the planet flies back to its home socket (state is unchanged).
   */
  placePlanet(planetId: string, slot: number): PlanetPlacement {
    const planet = this.config.orrery.planets.find((candidate) => candidate.id === planetId);
    if (planet == null) {
      return 'ignored';
    }
    if (planet.targetSlot !== slot) {
      this.emit({ type: 'planet-rejected', mechanism: 'orrery' });
      return 'wrong';
    }
    if (this.slots[planetId] === slot) {
      return 'correct';
    }
    this.slots[planetId] = slot;
    this.updateOrrerySolved();
    return 'correct';
  }

  /** Return a planet to its home socket (used when a release misses a slot). */
  returnPlanetHome(planetId: string): void {
    const planet = this.config.orrery.planets.find((candidate) => candidate.id === planetId);
    if (planet == null) {
      return;
    }
    this.slots[planetId] = planet.homeSlot;
  }

  private updateOrrerySolved(): void {
    if (this.orrerySolved) {
      return;
    }
    const solved = this.config.orrery.planets.every(
      (planet) => this.slots[planet.id] === planet.targetSlot,
    );
    if (!solved) {
      return;
    }
    this.orrerySolved = true;
    this.emit({ type: 'mechanism-solved', mechanism: 'orrery' });
    this.maybeOpenLantern();
  }

  // ------------------------------------------------------------- lantern ---

  private maybeOpenLantern(): void {
    if (this.open || this.solvedCount < MECHANISMS.length) {
      return;
    }
    this.open = true;
    this.emit({ type: 'lantern-open' });
  }

  isSolved(mechanism: MechanismId): boolean {
    switch (mechanism) {
      case 'dial':
        return this.dialSolved;
      case 'drawer':
        return this.drawerSolved;
      case 'orrery':
        return this.orrerySolved;
    }
  }

  get solvedCount(): number {
    return MECHANISMS.filter((mechanism) => this.isSolved(mechanism)).length;
  }

  get lanternOpen(): boolean {
    return this.open;
  }

  // --------------------------------------------------------------- reset ---

  reset(): void {
    this.angleValues = this.config.dial.rings.map(() => 0);
    this.ringSolved = this.config.dial.rings.map(() => false);
    this.dialSolved = false;
    this.pull = 0;
    this.bolt = 0;
    this.drawerSolved = false;
    for (const planet of this.config.orrery.planets) {
      this.slots[planet.id] = planet.homeSlot;
    }
    this.orrerySolved = false;
    this.open = false;
    this.emit({ type: 'reset' });
  }

  // --------------------------------------------------------------- assist ---

  /**
   * Accessibility fallback: advance one mechanism one small step toward being
   * solved. Called by the gaze-dwell / "Assist" affordance so every hand
   * interaction has a non-hand alternative that does not simply skip the puzzle.
   */
  assist(mechanism: MechanismId): boolean {
    switch (mechanism) {
      case 'dial': {
        const index = this.angleValues.findIndex((angle, ringIndex) => {
          const target = this.config.dial.rings[ringIndex]?.target ?? 0;
          return !anglesMatch(angle, target, this.config.dialTolerance);
        });
        if (index < 0) {
          return false;
        }
        const target = this.config.dial.rings[index]?.target ?? 0;
        const delta = angleDelta(this.angleValues[index] ?? 0, target);
        const step = Math.abs(delta) <= ASSIST_DIAL_STEP ? delta : Math.sign(delta) * ASSIST_DIAL_STEP;
        this.rotateRing(index, step);
        this.snapDialIfClose();
        return true;
      }
      case 'drawer': {
        if (!this.drawerOpen) {
          this.pullDrawer(this.pull + ASSIST_PULL_STEP);
          return true;
        }
        if (!this.boltReleased) {
          this.slideBolt(this.bolt + ASSIST_BOLT_STEP);
          return true;
        }
        return false;
      }
      case 'orrery': {
        const planet = this.config.orrery.planets.find(
          (candidate) => this.slots[candidate.id] !== candidate.targetSlot,
        );
        if (planet == null) {
          return false;
        }
        this.placePlanet(planet.id, planet.targetSlot);
        return true;
      }
    }
  }

  // ------------------------------------------------------------ snapshot ---

  snapshot(): PuzzleSnapshot {
    return Object.freeze({
      dial: {
        angles: this.angleValues.slice(),
        targets: this.config.dial.rings.map((ring) => ring.target),
        aligned: this.angleValues.map((angle, index) =>
          anglesMatch(
            angle,
            this.config.dial.rings[index]?.target ?? 0,
            this.config.dialTolerance,
          ),
        ),
        solved: this.dialSolved,
      },
      drawer: {
        pull: this.pull,
        open: this.drawerOpen,
        bolt: this.bolt,
        boltReleased: this.boltReleased,
        solved: this.drawerSolved,
      },
      orrery: {
        slots: { ...this.slots },
        solved: this.orrerySolved,
      },
      solvedCount: this.solvedCount,
      lanternOpen: this.open,
      finale: this.open,
    }) as PuzzleSnapshot;
  }
}
