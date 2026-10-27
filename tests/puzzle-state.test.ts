/**
 * Unit tests for The Lantern Room's pure puzzle state machine.
 *
 * These run without a browser, WebGL or IWSDK: `npm test` executes them with
 * Vitest. The scene code is a thin view over this model, so the rules that
 * decide when the lantern opens are fully covered here.
 */
import { describe, expect, it } from 'vitest';
import {
  addAngle,
  angleDelta,
  anglesMatch,
  DEFAULT_PUZZLE_CONFIG,
  LanternPuzzle,
  MECHANISMS,
  normalizeAngle,
  type PuzzleEvent,
} from '../src/puzzle/state.js';

function solveDial(puzzle: LanternPuzzle): void {
  DEFAULT_PUZZLE_CONFIG.dial.rings.forEach((ring, index) => {
    puzzle.setRingAngle(index, ring.target);
  });
  puzzle.snapDialIfClose();
}

function solveDrawer(puzzle: LanternPuzzle): void {
  puzzle.pullDrawer(DEFAULT_PUZZLE_CONFIG.drawer.maxPull);
  puzzle.slideBolt(DEFAULT_PUZZLE_CONFIG.drawer.maxBolt);
}

function solveOrrery(puzzle: LanternPuzzle): void {
  for (const planet of DEFAULT_PUZZLE_CONFIG.orrery.planets) {
    expect(puzzle.placePlanet(planet.id, planet.targetSlot)).toBe('correct');
  }
}

describe('angle helpers', () => {
  it('normalizes angles into (-pi, pi]', () => {
    expect(normalizeAngle(0)).toBeCloseTo(0);
    expect(normalizeAngle(Math.PI * 2)).toBeCloseTo(0);
    expect(normalizeAngle(Math.PI * 2 + 0.5)).toBeCloseTo(0.5);
    expect(normalizeAngle(-Math.PI * 2 - 0.5)).toBeCloseTo(-0.5);
    expect(normalizeAngle(-Math.PI)).toBeCloseTo(Math.PI);
  });

  it('rejects non-finite angles', () => {
    expect(() => normalizeAngle(Number.NaN)).toThrow(RangeError);
  });

  it('computes the shortest signed delta across the wrap point', () => {
    expect(angleDelta(3.0, -3.0)).toBeCloseTo((Math.PI * 2 - 6.0));
    expect(angleDelta(0, 0.25)).toBeCloseTo(0.25);
    expect(angleDelta(0.25, 0)).toBeCloseTo(-0.25);
  });

  it('adds angles with wrapping', () => {
    expect(addAngle(Math.PI - 0.1, 0.2)).toBeCloseTo(-Math.PI + 0.1);
  });

  it('matches angles within tolerance', () => {
    expect(anglesMatch(0.1, 0.12, 0.05)).toBe(true);
    expect(anglesMatch(0.1, 0.3, 0.05)).toBe(false);
    expect(() => anglesMatch(0, 0, -1)).toThrow(RangeError);
  });
});

describe('LanternPuzzle initial state', () => {
  it('starts unsolved with no lantern', () => {
    const puzzle = new LanternPuzzle();
    const snapshot = puzzle.snapshot();
    expect(snapshot.solvedCount).toBe(0);
    expect(snapshot.lanternOpen).toBe(false);
    expect(snapshot.dial.solved).toBe(false);
    expect(snapshot.drawer.solved).toBe(false);
    expect(snapshot.orrery.solved).toBe(false);
    for (const mechanism of MECHANISMS) {
      expect(puzzle.isSolved(mechanism)).toBe(false);
    }
  });

  it('places planets at their home sockets', () => {
    const puzzle = new LanternPuzzle();
    for (const planet of DEFAULT_PUZZLE_CONFIG.orrery.planets) {
      expect(puzzle.planetSlots[planet.id]).toBe(planet.homeSlot);
    }
  });
});

describe('constellation dial', () => {
  it('does not solve while any ring is off target', () => {
    const puzzle = new LanternPuzzle();
    puzzle.setRingAngle(0, DEFAULT_PUZZLE_CONFIG.dial.rings[0]!.target);
    puzzle.setRingAngle(1, DEFAULT_PUZZLE_CONFIG.dial.rings[1]!.target);
    puzzle.setRingAngle(2, 0);
    expect(puzzle.snapDialIfClose()).toBe(false);
    expect(puzzle.isSolved('dial')).toBe(false);
  });

  it('snaps and solves when all three rings align', () => {
    const puzzle = new LanternPuzzle();
    solveDial(puzzle);
    expect(puzzle.isSolved('dial')).toBe(true);
    const angles = puzzle.ringAngles();
    DEFAULT_PUZZLE_CONFIG.dial.rings.forEach((ring, index) => {
      expect(angles[index]).toBeCloseTo(ring.target);
    });
  });

  it('solves through incremental ring rotation like a wrist twist', () => {
    const puzzle = new LanternPuzzle();
    DEFAULT_PUZZLE_CONFIG.dial.rings.forEach((ring, index) => {
      // Rotate in small steps, exactly like the grab system applying wrist
      // rotation over multiple frames.
      for (let step = 0; step < 10; step += 1) {
        puzzle.rotateRing(index, ring.target / 10);
      }
    });
    expect(puzzle.snapDialIfClose()).toBe(true);
    expect(puzzle.isSolved('dial')).toBe(true);
  });

  it('rejects invalid ring indices', () => {
    const puzzle = new LanternPuzzle();
    expect(() => puzzle.rotateRing(3, 0.1)).toThrow(RangeError);
    expect(() => puzzle.setRingAngle(-1, 0.1)).toThrow(RangeError);
  });

  it('respects the configured tolerance', () => {
    const puzzle = new LanternPuzzle();
    const ring = DEFAULT_PUZZLE_CONFIG.dial.rings[0]!;
    puzzle.setRingAngle(0, ring.target + DEFAULT_PUZZLE_CONFIG.dialTolerance * 0.9);
    expect(puzzle.ringAligned(0)).toBe(true);
    puzzle.setRingAngle(0, ring.target + DEFAULT_PUZZLE_CONFIG.dialTolerance * 1.5);
    expect(puzzle.ringAligned(0)).toBe(false);
  });
});

describe('drawer and bolt', () => {
  it('opens at the open-pull threshold', () => {
    const puzzle = new LanternPuzzle();
    puzzle.pullDrawer(DEFAULT_PUZZLE_CONFIG.drawer.openPull * 0.5);
    expect(puzzle.drawerOpen).toBe(false);
    puzzle.pullDrawer(DEFAULT_PUZZLE_CONFIG.drawer.openPull);
    expect(puzzle.drawerOpen).toBe(true);
  });

  it('needs both the drawer open and the bolt slid to solve', () => {
    const puzzle = new LanternPuzzle();
    puzzle.slideBolt(DEFAULT_PUZZLE_CONFIG.drawer.maxBolt);
    expect(puzzle.isSolved('drawer')).toBe(false);
    puzzle.pullDrawer(DEFAULT_PUZZLE_CONFIG.drawer.maxPull);
    expect(puzzle.isSolved('drawer')).toBe(true);
  });

  it('clamps pull and bolt travel to the configured range', () => {
    const puzzle = new LanternPuzzle();
    puzzle.pullDrawer(99);
    puzzle.slideBolt(99);
    const snapshot = puzzle.snapshot();
    expect(snapshot.drawer.pull).toBe(DEFAULT_PUZZLE_CONFIG.drawer.maxPull);
    expect(snapshot.drawer.bolt).toBe(DEFAULT_PUZZLE_CONFIG.drawer.maxBolt);
    puzzle.pullDrawer(-5);
    puzzle.slideBolt(-5);
    expect(puzzle.snapshot().drawer.pull).toBe(0);
    expect(puzzle.snapshot().drawer.bolt).toBe(0);
  });
});

describe('orrery', () => {
  it('rejects a planet on the wrong orbit slot', () => {
    const puzzle = new LanternPuzzle();
    const planet = DEFAULT_PUZZLE_CONFIG.orrery.planets[0]!;
    const wrongSlot = (planet.targetSlot + 1) % 3;
    expect(puzzle.placePlanet(planet.id, wrongSlot)).toBe('wrong');
    expect(puzzle.planetSlots[planet.id]).toBe(planet.homeSlot);
  });

  it('ignores unknown planets', () => {
    const puzzle = new LanternPuzzle();
    expect(puzzle.placePlanet('nope', 0)).toBe('ignored');
  });

  it('solves when every planet is on its target slot', () => {
    const puzzle = new LanternPuzzle();
    solveOrrery(puzzle);
    expect(puzzle.isSolved('orrery')).toBe(true);
  });

  it('returns planets to their home sockets', () => {
    const puzzle = new LanternPuzzle();
    const planet = DEFAULT_PUZZLE_CONFIG.orrery.planets[1]!;
    puzzle.returnPlanetHome(planet.id);
    expect(puzzle.planetSlots[planet.id]).toBe(planet.homeSlot);
  });
});

describe('lantern progression', () => {
  it('opens only after all three mechanisms are solved', () => {
    const puzzle = new LanternPuzzle();
    const events: PuzzleEvent[] = [];
    puzzle.subscribe((event) => events.push(event));

    solveDial(puzzle);
    expect(puzzle.solvedCount).toBe(1);
    expect(puzzle.lanternOpen).toBe(false);

    solveDrawer(puzzle);
    expect(puzzle.solvedCount).toBe(2);
    expect(puzzle.lanternOpen).toBe(false);

    solveOrrery(puzzle);
    expect(puzzle.solvedCount).toBe(3);
    expect(puzzle.lanternOpen).toBe(true);
    expect(events.filter((event) => event.type === 'lantern-open')).toHaveLength(1);
  });

  it('does not double count repeated solves', () => {
    const puzzle = new LanternPuzzle();
    solveDrawer(puzzle);
    solveDrawer(puzzle);
    solveDrawer(puzzle);
    expect(puzzle.solvedCount).toBe(1);
  });

  it('emits one mechanism-solved event per mechanism', () => {
    const puzzle = new LanternPuzzle();
    const solved: string[] = [];
    puzzle.subscribe((event) => {
      if (event.type === 'mechanism-solved' && event.mechanism != null) {
        solved.push(event.mechanism);
      }
    });
    solveDial(puzzle);
    solveDrawer(puzzle);
    solveOrrery(puzzle);
    expect(solved).toEqual(['dial', 'drawer', 'orrery']);
  });

  it('resets back to the start state', () => {
    const puzzle = new LanternPuzzle();
    solveDial(puzzle);
    solveDrawer(puzzle);
    solveOrrery(puzzle);
    expect(puzzle.lanternOpen).toBe(true);
    puzzle.reset();
    const snapshot = puzzle.snapshot();
    expect(snapshot.solvedCount).toBe(0);
    expect(snapshot.lanternOpen).toBe(false);
    expect(puzzle.ringAngles()).toEqual([0, 0, 0]);
    expect(snapshot.drawer.pull).toBe(0);
    expect(snapshot.drawer.bolt).toBe(0);
    for (const planet of DEFAULT_PUZZLE_CONFIG.orrery.planets) {
      expect(puzzle.planetSlots[planet.id]).toBe(planet.homeSlot);
    }
  });

  it('can be solved again after a reset', () => {
    const puzzle = new LanternPuzzle();
    solveDial(puzzle);
    solveDrawer(puzzle);
    solveOrrery(puzzle);
    puzzle.reset();
    solveDial(puzzle);
    solveDrawer(puzzle);
    solveOrrery(puzzle);
    expect(puzzle.lanternOpen).toBe(true);
  });
});

describe('accessibility assist', () => {
  it('advances the dial without instantly solving it', () => {
    const puzzle = new LanternPuzzle();
    expect(puzzle.assist('dial')).toBe(true);
    expect(puzzle.isSolved('dial')).toBe(false);
    // Many assist steps are required — assist is a slow fallback, not a skip.
    for (let step = 0; step < 40 && !puzzle.isSolved('dial'); step += 1) {
      puzzle.assist('dial');
    }
    expect(puzzle.isSolved('dial')).toBe(true);
  });

  it('opens and unbolts the drawer over several steps', () => {
    const puzzle = new LanternPuzzle();
    for (let step = 0; step < 20 && !puzzle.isSolved('drawer'); step += 1) {
      puzzle.assist('drawer');
    }
    expect(puzzle.isSolved('drawer')).toBe(true);
  });

  it('places one planet per assist step', () => {
    const puzzle = new LanternPuzzle();
    expect(puzzle.assist('orrery')).toBe(true);
    expect(puzzle.solvedCount).toBe(0);
    expect(puzzle.assist('orrery')).toBe(true);
    expect(puzzle.assist('orrery')).toBe(true);
    expect(puzzle.isSolved('orrery')).toBe(true);
    expect(puzzle.assist('orrery')).toBe(false);
  });

  it('drives the full experience to the lantern via assist only', () => {
    const puzzle = new LanternPuzzle();
    for (const mechanism of MECHANISMS) {
      for (let step = 0; step < 40 && !puzzle.isSolved(mechanism); step += 1) {
        puzzle.assist(mechanism);
      }
    }
    expect(puzzle.lanternOpen).toBe(true);
  });
});

describe('configuration guard rails', () => {
  it('requires exactly three rings and three planets', () => {
    expect(
      () =>
        new LanternPuzzle({
          ...DEFAULT_PUZZLE_CONFIG,
          dial: { rings: [] },
        }),
    ).toThrow(RangeError);
  });
});
