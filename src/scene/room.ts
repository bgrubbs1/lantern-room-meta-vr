/**
 * The Lantern Room — runtime logic.
 *
 * The scene is built procedurally by `buildRoomScene`; this class owns the
 * per-frame behaviour: reading grab state out of IWSDK's ECS, driving the pure
 * puzzle state machine, animating the lantern, synthesising audio cues, and
 * providing the accessibility alternatives (gaze-dwell assist + keyboard).
 *
 * Hands-first design notes
 * ------------------------
 * - Every mechanism is an ECS entity with `OneHandGrabbable`. IWSDK's GrabSystem
 *   routes hand pinch (and controller select) into a grab pointer, and near-grab
 *   constraints give us the physical motion: rings rotate on Y, the drawer only
 *   slides on Z, the bolt only slides on X, planets move inside a 3D box.
 * - No locomotion: the whole experience fits in the seated "airplane seat" test
 *   volume (roughly a 2 ft radius around the table).
 */
import {
  Grabbed,
  MeshBasicMaterial,
  Object3D,
  OneHandGrabbable,
  Vector3,
  VisibilityState,
  type World,
} from '@iwsdk/core';
import { AudioEngine } from '../lib/audio.js';
import { createTextTexture } from '../lib/canvas-text.js';
import { angleDelta, LanternPuzzle, type MechanismId } from '../puzzle/state.js';
import {
  buildRoomScene,
  LAYOUT,
  ORBIT_SLOTS,
  TARGET_ANGLES,
  type DialRingView,
  type PlanetView,
  type RoomScene,
  type SettingsButtonView,
} from './build.js';
import { RoomTheme } from './theme.js';

/** Angular window (radians) in which a released ring snaps onto its star line. */
const DIAL_SNAP_WINDOW = 0.3;
/** How close a released planet must be to a cradle to count as a placement. */
const PLANET_DROP_DISTANCE = 0.1;
/** Bolt home local X inside the drawer. */
const BOLT_HOME_X = -0.1;
/** Gaze assist tuning. */
const GAZE_CONE_DOT = Math.cos((11 * Math.PI) / 180);
const GAZE_MAX_DISTANCE = 2.1;
const GAZE_DWELL_SECONDS = 1.5;
const GAZE_COOLDOWN_SECONDS = 0.9;

const INITIAL_HINT = 'Pinch a ring and turn it to a star line';

type GazeTargetKind = MechanismId | 'lantern';

interface GazeTarget {
  kind: GazeTargetKind;
  cosine: number;
  distance: number;
  position: Vector3;
}

interface Pulse {
  object: Object3D;
  base: Vector3;
  t: number;
  duration: number;
  amount: number;
}

interface Tween {
  object: Object3D;
  from: Vector3;
  to: Vector3;
  t: number;
  duration: number;
  done?: () => void;
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class LanternRoom {
  readonly scene: RoomScene;
  readonly puzzle: LanternPuzzle;
  readonly theme: RoomTheme;
  readonly audio = new AudioEngine();

  private readonly world: World;
  private readonly headPosition = new Vector3();
  private readonly headDirection = new Vector3();
  private readonly candidate = new Vector3();
  private readonly toTarget = new Vector3();

  private elapsed = 0;
  private lanternLevel = 0;
  private finaleT = 0;
  private finaleActive = false;
  private finaleHintShown = false;
  private restartAffordance = false;
  private restartWasGrabbed = false;

  private gazeTargetKind: GazeTargetKind | null = null;
  private gazeDwell = 0;
  private gazeCooldown = 0;
  private gazeRingVisible = false;

  private gentleMotion = false;
  private gazeAssist = false;

  private readonly pulses: Pulse[] = [];
  private readonly tweens: Tween[] = [];
  private readonly lastSolved: Record<MechanismId, boolean> = {
    dial: false,
    drawer: false,
    orrery: false,
  };
  private lastSolvedCount = 0;
  private audioHooked = false;

  private hintText = INITIAL_HINT;

  constructor(world: World) {
    this.world = world;
    this.theme = new RoomTheme();
    this.puzzle = new LanternPuzzle();
    this.scene = buildRoomScene(world, this.theme, this.puzzle);
    this.refreshSettingsIndicators();
    this.setHint(INITIAL_HINT);
    this.hookAudioUnlock();
    this.hookKeyboard();
  }

  get highContrast(): boolean {
    return this.theme.isHighContrast;
  }

  get gentle(): boolean {
    return this.gentleMotion;
  }

  get gazeEnabled(): boolean {
    return this.gazeAssist;
  }

  get solvedCount(): number {
    return this.puzzle.solvedCount;
  }

  // ------------------------------------------------------------- lifecycle ---

  private hookAudioUnlock(): void {
    if (typeof window === 'undefined' || this.audioHooked) {
      return;
    }
    this.audioHooked = true;
    const unlock = (): void => {
      this.audio.unlock();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    this.world.visibilityState.subscribe((state) => {
      if (state === VisibilityState.Visible || state === VisibilityState.VisibleBlurred) {
        this.audio.unlock();
      }
    });
  }

  private hookKeyboard(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }
      this.audio.unlock();
      switch (event.key.toLowerCase()) {
        case 'c':
          this.toggleContrast();
          break;
        case 'g':
          this.toggleGentleMotion();
          break;
        case 'a':
          this.toggleGazeAssist();
          break;
        case 'r':
          this.restart();
          break;
        default:
          break;
      }
    });
  }

  // ---------------------------------------------------------------- update ---

  update(delta: number, time: number): void {
    const dt = Math.min(delta, 1 / 20);
    this.elapsed += dt;
    this.readHeadPose();

    this.audio.updateListener(this.headPosition.x, this.headPosition.y, this.headPosition.z);

    this.updateDial(dt);
    this.updateDrawer(dt);
    this.updateOrrery(dt);
    this.updateSettings();
    this.updateLantern(dt, time);
    this.updateGazeAssist(dt);
    this.updateDust(dt);
    this.updateFireflies(dt);
    this.updatePulses(dt);
    this.updateTweens(dt);
    this.updateHintBillboard(dt);
    this.detectProgress();
  }

  private readHeadPose(): void {
    if (this.world.session != null) {
      this.world.player.head.getWorldPosition(this.headPosition);
    } else {
      this.world.camera.getWorldPosition(this.headPosition);
    }
    this.world.camera.getWorldDirection(this.headDirection);
    if (this.headPosition.lengthSq() === 0) {
      this.headPosition.set(0, 1.25, 0);
    }
  }

  // ------------------------------------------------------------------ dial ---

  private updateDial(dt: number): void {
    void dt;
    for (const ring of this.scene.dial.rings) {
      if (ring.locked) {
        continue;
      }
      const grabbed = ring.entity.hasComponent(Grabbed);
      if (grabbed) {
        this.puzzle.setRingAngle(ring.index, ring.group.rotation.y);
      } else if (ring.wasGrabbed) {
        const target = TARGET_ANGLES[ring.index] ?? 0;
        const current = this.puzzle.ringAngles()[ring.index] ?? 0;
        if (Math.abs(angleDelta(current, target)) <= DIAL_SNAP_WINDOW) {
          this.lockRing(ring, target);
        } else {
          this.audio.play('click', this.cueAt(this.scene.dial.center));
        }
      }
      ring.wasGrabbed = grabbed;
    }
    if (this.puzzle.snapDialIfClose()) {
      this.onDialSolved();
    }
  }

  private lockRing(ring: DialRingView, target: number): void {
    ring.locked = true;
    this.puzzle.setRingAngle(ring.index, target);
    ring.group.rotation.set(0, target, 0);
    ring.entity.removeComponent(OneHandGrabbable);
    this.audio.play('chime', {
      ...this.cueAt(this.scene.dial.center),
      frequency: 659.25 + ring.index * 146.83,
    });
    this.spawnPulse(ring.group, 0.34, 0.45);
  }

  private onDialSolved(): void {
    this.audio.play('success', this.cueAt(this.scene.dial.center));
    this.setHint('Pull the drawer open, then slide the hidden bolt');
  }

  // ---------------------------------------------------------------- drawer ---

  private updateDrawer(dt: number): void {
    const drawer = this.scene.drawer;
    const pull = clamp(drawer.group.position.z - LAYOUT.drawerClosed.z, 0, LAYOUT.drawerTravel);
    this.puzzle.pullDrawer(pull);

    if (this.puzzle.drawerOpen && !drawer.revealed) {
      drawer.revealed = true;
      this.enableBolt();
      this.audio.play('thunk', {
        ...this.cueAt(drawer.group.position),
        gain: 0.9,
      });
      this.spawnPulse(drawer.knob, 0.4, 0.4);
      this.setHint('Slide the hidden bolt to the side');
    }

    if (drawer.boltEnabled) {
      const boltGrabbed = drawer.boltEntity.hasComponent(Grabbed);
      const travel = drawer.boltGroup.position.x - BOLT_HOME_X;
      this.puzzle.slideBolt(travel);
      if (!boltGrabbed && drawer.boltWasGrabbed) {
        this.audio.play('click', this.cueAt(drawer.group.position));
      }
      drawer.boltWasGrabbed = boltGrabbed;
    }

    if (this.puzzle.isSolved('drawer') && !drawer.solvedLocked) {
      drawer.solvedLocked = true;
      drawer.entity.removeComponent(OneHandGrabbable);
      drawer.boltEntity.removeComponent(OneHandGrabbable);
      drawer.boltEnabled = false;
    }
    void dt;
  }

  private enableBolt(): void {
    const drawer = this.scene.drawer;
    if (drawer.boltEnabled) {
      return;
    }
    drawer.boltEnabled = true;
    drawer.boltEntity.addComponent(OneHandGrabbable, {
      rotate: false,
      translate: true,
      translateMin: [BOLT_HOME_X, 0.022, 0.02],
      translateMax: [BOLT_HOME_X + 0.07, 0.022, 0.02],
    });
  }

  // ---------------------------------------------------------------- orrery ---

  private updateOrrery(dt: number): void {
    for (const planet of this.scene.orrery.planets) {
      if (planet.tween != null) {
        continue;
      }
      if (planet.locked) {
        continue;
      }
      const grabbed = planet.entity.hasComponent(Grabbed);
      if (grabbed) {
        const minimumY = LAYOUT.table.topY + 0.02;
        if (planet.mesh.position.y < minimumY) {
          planet.mesh.position.y = minimumY;
        }
      } else if (planet.wasGrabbed) {
        this.settlePlanet(planet);
      }
      planet.wasGrabbed = grabbed;
    }
    this.updateSlotGlow();
    void dt;
  }

  private settlePlanet(planet: PlanetView): void {
    const position = planet.mesh.position;
    let nearestSlot = this.scene.orrery.slots[0];
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const slot of this.scene.orrery.slots) {
      const distance = position.distanceTo(slot.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestSlot = slot;
      }
    }
    if (nearestSlot != null && nearestDistance <= PLANET_DROP_DISTANCE) {
      const result = this.puzzle.placePlanet(planet.id, nearestSlot.index);
      if (result === 'correct') {
        planet.locked = true;
        planet.entity.removeComponent(OneHandGrabbable);
        this.audio.play('chime', {
          ...this.cueAt(nearestSlot.position),
          frequency: 783.99,
        });
        this.moveTo(planet.mesh, nearestSlot.position, 0.28);
        return;
      }
      this.audio.play('error', this.cueAt(nearestSlot.position));
    } else {
      this.puzzle.returnPlanetHome(planet.id);
      this.audio.play('click', this.cueAt(position));
    }
    this.moveTo(planet.mesh, planet.home, 0.34);
  }

  private updateSlotGlow(): void {
    for (const slot of this.scene.orrery.slots) {
      const solved = this.scene.orrery.planets.some(
        (planet) => planet.locked && planet.targetSlot === slot.index,
      );
      const material = this.scene.orrery.slotGlowMaterials[slot.index];
      if (material == null) {
        continue;
      }
      if (material.emissive == null) {
        continue;
      }
      const target = solved ? 1.6 : 0;
      material.emissiveIntensity += (target - material.emissiveIntensity) * 0.15;
      material.emissive.setHex(solved ? this.theme.palette.warm : 0x000000);
      const cradle = slot.cradle;
      const pulse = solved ? 1 + Math.sin(this.elapsed * 2.4) * 0.04 : 1;
      cradle.scale.setScalar(pulse);
    }
  }

  // --------------------------------------------------------------- lantern ---

  private updateLantern(dt: number, time: number): void {
    const lantern = this.scene.lantern;
    const target = this.puzzle.solvedCount / 3;
    this.lanternLevel += (target - this.lanternLevel) * Math.min(1, dt * 2.4);
    const flicker = this.gentleMotion
      ? 0
      : (Math.sin(time * 6.7) * 0.5 + Math.sin(time * 13.1 + 1.7) * 0.5) * 0.05;

    lantern.coreMaterial.emissiveIntensity =
      0.3 + this.lanternLevel * 2.1 + Math.max(0, flicker);
    const coreScale = 1 + this.lanternLevel * 0.12 + (this.finaleActive ? 0.1 : 0);
    lantern.core.scale.setScalar(coreScale);
    lantern.core.rotation.y += dt * 0.25;
    lantern.core.rotation.x += dt * 0.12;
    lantern.light.intensity = 0.75 + this.lanternLevel * 1.7 + Math.max(0, flicker) * 2;
    const haloMaterial = lantern.halo.material as { opacity: number };
    lantern.halo.visible = this.lanternLevel > 0.02 || this.finaleActive;
    haloMaterial.opacity = this.lanternLevel * 0.2 + (this.finaleActive ? 0.18 : 0);
    lantern.halo.scale.setScalar(1 + this.lanternLevel * 0.5);

    const mechanisms: MechanismId[] = ['dial', 'drawer', 'orrery'];
    lantern.gems.forEach((gem, index) => {
      const solved = mechanisms[index] != null && this.puzzle.isSolved(mechanisms[index]);
      const base = solved ? 1.7 + Math.sin(this.elapsed * 3.2 + index) * 0.25 : 0.04;
      gem.material.emissiveIntensity += (base - gem.material.emissiveIntensity) * 0.12;
    });

    if (this.puzzle.lanternOpen && !this.finaleActive) {
      this.startFinale();
    }

    if (this.finaleActive) {
      this.finaleT += dt;
      const rise = easeInOutCubic(clamp(this.finaleT / 3.2, 0, 1));
      lantern.cap.position.y = 0.29 + rise * 0.2;
      lantern.cap.rotation.y += dt * (0.3 + rise * 0.8);
      lantern.petals.forEach((petal) => {
        const open = easeInOutCubic(clamp(this.finaleT / 2.2, 0, 1));
        petal.rotation.x = -0.95 * open;
      });
      lantern.light.intensity += rise * 1.1;
      if (!this.finaleHintShown && this.finaleT > 3.4) {
        this.finaleHintShown = true;
        this.addRestartAffordance();
        this.setHint('The lantern is awake — pinch it to begin again');
      }
      if (this.restartAffordance) {
        const grabbed = lantern.entity.hasComponent(Grabbed);
        if (grabbed && !this.restartWasGrabbed) {
          this.restartWasGrabbed = grabbed;
          this.restart();
          return;
        }
        this.restartWasGrabbed = grabbed;
      }
    }
  }

  private startFinale(): void {
    this.finaleActive = true;
    this.finaleT = 0;
    this.scene.fireflies.active = true;
    this.scene.fireflies.points.visible = true;
    this.scene.fireflies.t = 0;
    this.audio.play('finale', {
      ...this.cueAt(this.scene.lantern.group.position),
      gain: 1,
    });
    this.spawnPulse(this.scene.lantern.core, 0.2, 1.2);
  }

  private addRestartAffordance(): void {
    if (this.restartAffordance) {
      return;
    }
    this.restartAffordance = true;
    this.scene.lantern.entity.addComponent(OneHandGrabbable, {
      rotate: false,
      translate: false,
    });
  }

  private removeRestartAffordance(): void {
    if (!this.restartAffordance) {
      return;
    }
    this.restartAffordance = false;
    this.scene.lantern.entity.removeComponent(OneHandGrabbable);
  }

  // -------------------------------------------------------------- settings ---

  private updateSettings(): void {
    for (const button of this.scene.settings.buttons) {
      const grabbed = button.entity.hasComponent(Grabbed);
      if (grabbed && !button.wasGrabbed) {
        this.activateSetting(button);
      }
      button.wasGrabbed = grabbed;
    }
    this.refreshSettingsIndicators();
  }

  private activateSetting(button: SettingsButtonView): void {
    this.audio.unlock();
    switch (button.id) {
      case 'contrast':
        this.toggleContrast();
        break;
      case 'motion':
        this.toggleGentleMotion();
        break;
      case 'gaze':
        this.toggleGazeAssist();
        break;
      case 'reset':
        this.audio.play('thunk', this.cueAt(button.knob.getWorldPosition(new Vector3())));
        this.restart();
        break;
    }
    this.spawnPulse(button.knob, 0.3, 0.3);
  }

  private toggleContrast(): void {
    this.theme.setHighContrast(!this.theme.isHighContrast);
    // Re-render the hint line so it matches the active palette.
    this.renderHintTexture(true);
    this.audio.play('click', this.cueAt(this.scene.settings.group.position));
    this.refreshSettingsIndicators();
  }

  private toggleGentleMotion(): void {
    this.gentleMotion = !this.gentleMotion;
    this.audio.play('click', this.cueAt(this.scene.settings.group.position));
    this.refreshSettingsIndicators();
  }

  private toggleGazeAssist(): void {
    this.gazeAssist = !this.gazeAssist;
    this.gazeDwell = 0;
    this.gazeTargetKind = null;
    this.scene.reticle.group.visible = false;
    this.audio.play('click', this.cueAt(this.scene.settings.group.position));
    if (this.gazeAssist) {
      this.setHint('Gaze at a mechanism to assist it');
    }
    this.refreshSettingsIndicators();
  }

  private refreshSettingsIndicators(): void {
    const palette = this.theme.palette;
    const states: Record<SettingsButtonView['id'], { on: boolean; color: number }> = {
      contrast: { on: this.theme.isHighContrast, color: palette.warm },
      motion: { on: this.gentleMotion, color: palette.cool },
      gaze: { on: this.gazeAssist, color: palette.cool },
      reset: { on: false, color: palette.warm },
    };
    for (const button of this.scene.settings.buttons) {
      const state = states[button.id];
      button.indicatorMaterial.emissive.setHex(state.on ? state.color : 0x000000);
      button.indicatorMaterial.emissiveIntensity = state.on ? 1.4 : 0;
      button.indicatorMaterial.color.setHex(state.on ? state.color : 0x3b2a1b);
    }
  }

  // ---------------------------------------------------------- gaze assist ---

  private updateGazeAssist(dt: number): void {
    if (!this.gazeAssist) {
      this.scene.reticle.group.visible = false;
      return;
    }
    this.gazeCooldown = Math.max(0, this.gazeCooldown - dt);
    const best = this.findGazeTarget();
    if (best == null) {
      this.gazeTargetKind = null;
      this.gazeDwell = 0;
      this.scene.reticle.group.visible = false;
      return;
    }
    if (this.gazeTargetKind !== best.kind) {
      this.gazeTargetKind = best.kind;
      this.gazeDwell = 0;
    }
    this.gazeDwell += dt;

    const reticle = this.scene.reticle;
    reticle.group.visible = true;
    this.gazeRingVisible = true;
    reticle.group.position.copy(best.position);
    reticle.group.lookAt(this.headPosition);
    const progress = clamp(this.gazeDwell / GAZE_DWELL_SECONDS, 0, 1);
    reticle.ring.scale.setScalar(1 + progress * 0.6);
    reticle.material.opacity = 0.35 + progress * 0.6;
    reticle.material.color.setHex(
      progress >= 1 ? this.theme.palette.warm : this.theme.palette.cool,
    );

    if (this.gazeDwell >= GAZE_DWELL_SECONDS && this.gazeCooldown <= 0) {
      this.gazeDwell = 0;
      this.gazeCooldown = GAZE_COOLDOWN_SECONDS;
      this.applyGazeAssist(best.kind);
    }
  }

  private findGazeTarget(): GazeTarget | undefined {
    const candidates: Array<{ kind: GazeTargetKind; position: Vector3 }> = [
      {
        kind: 'dial',
        position: LAYOUT.dial.clone().add(new Vector3(0, 0.03, 0)),
      },
      {
        kind: 'drawer',
        position: this.scene.drawer.group.position.clone().add(new Vector3(0, 0.02, 0.1)),
      },
      {
        kind: 'orrery',
        position: LAYOUT.orrery.clone().add(new Vector3(0, 0.16, 0)),
      },
    ];
    if (this.puzzle.lanternOpen) {
      candidates.push({
        kind: 'lantern',
        position: LAYOUT.lantern.clone().add(new Vector3(0, 0.2, 0)),
      });
    }
    if (!this.puzzle.isSolved('orrery')) {
      candidates.push({
        kind: 'orrery',
        position: LAYOUT.orrery.clone().add(new Vector3(0, 0.05, 0)),
      });
    }
    let best: GazeTarget | undefined;
    for (const candidate of candidates) {
      this.toTarget.copy(candidate.position).sub(this.headPosition);
      const distance = this.toTarget.length();
      if (distance < 0.2 || distance > GAZE_MAX_DISTANCE) {
        continue;
      }
      this.toTarget.normalize();
      const cosine = this.toTarget.dot(this.headDirection);
      if (cosine < GAZE_CONE_DOT) {
        continue;
      }
      if (best == null || cosine > best.cosine) {
        best = {
          kind: candidate.kind,
          cosine,
          distance,
          position: candidate.position.clone(),
        };
      }
    }
    return best;
  }

  private applyGazeAssist(kind: GazeTargetKind): void {
    this.audio.play('assist', this.cueAt(this.scene.settings.group.position));
    if (kind === 'lantern') {
      this.restart();
      return;
    }
    const advanced = this.puzzle.assist(kind);
    if (!advanced) {
      return;
    }
    if (kind === 'dial') {
      this.syncDialRingsFromPuzzle();
    }
    if (kind === 'drawer') {
      this.syncDrawerFromPuzzle();
    }
  }

  /** After gaze assist moves a ring, push the state machine's angle to the mesh. */
  private syncDialRingsFromPuzzle(): void {
    const angles = this.puzzle.ringAngles();
    for (const ring of this.scene.dial.rings) {
      const angle = angles[ring.index] ?? 0;
      ring.group.rotation.set(0, angle, 0);
    }
    if (this.puzzle.snapDialIfClose()) {
      for (const ring of this.scene.dial.rings) {
        const target = TARGET_ANGLES[ring.index] ?? 0;
        if (!ring.locked) {
          this.lockRing(ring, target);
        }
      }
      this.onDialSolved();
    }
  }

  private syncDrawerFromPuzzle(): void {
    const drawer = this.scene.drawer;
    drawer.group.position.z = LAYOUT.drawerClosed.z + this.puzzle.snapshot().drawer.pull;
    const boltTravel = this.puzzle.snapshot().drawer.bolt;
    drawer.boltGroup.position.x = BOLT_HOME_X + boltTravel;
    if (this.puzzle.drawerOpen && !drawer.revealed) {
      drawer.revealed = true;
      this.enableBolt();
      this.setHint('Slide the hidden bolt to the side');
    }
  }

  // ------------------------------------------------------------------ misc ---

  private updateDust(dt: number): void {
    const dust = this.scene.dust;
    const speedScale = this.gentleMotion ? 0.15 : 1;
    for (let index = 0; index < dust.speeds.length; index += 1) {
      const positionIndex = index * 3;
      dust.positions[positionIndex + 1] += (dust.speeds[index] ?? 0.01) * dt * speedScale;
      dust.positions[positionIndex] +=
        Math.sin(this.elapsed * 0.4 + index) * 0.0006 * dt * 60 * speedScale;
      if ((dust.positions[positionIndex + 1] ?? 0) > 1.95) {
        dust.positions[positionIndex + 1] = 0.15;
      }
    }
    dust.points.geometry.attributes['position']!.needsUpdate = true;
  }

  private updateFireflies(dt: number): void {
    const fireflies = this.scene.fireflies;
    if (!fireflies.active) {
      return;
    }
    fireflies.t += dt;
    const damping = this.gentleMotion ? 0.6 : 1;
    for (let index = 0; index < fireflies.velocities.length / 3; index += 1) {
      const offset = index * 3;
      fireflies.positions[offset] += (fireflies.velocities[offset] ?? 0) * dt * damping;
      fireflies.positions[offset + 1] +=
        (fireflies.velocities[offset + 1] ?? 0) * dt * damping;
      fireflies.positions[offset + 2] +=
        (fireflies.velocities[offset + 2] ?? 0) * dt * damping;
      const y = fireflies.positions[offset + 1] ?? 0;
      if (y < 0.35) {
        fireflies.positions[offset + 1] = 1.05 + (index % 7) * 0.02;
      }
      if (fireflies.t < 4) {
        fireflies.velocities[offset + 1] =
          (fireflies.velocities[offset + 1] ?? 0) - 0.05 * dt;
      }
    }
    fireflies.points.geometry.attributes['position']!.needsUpdate = true;
    fireflies.material.opacity = clamp(1 - Math.max(0, fireflies.t - 9) / 6, 0, 1);
    if (fireflies.material.opacity <= 0.01) {
      fireflies.active = false;
      fireflies.points.visible = false;
    }
  }

  private updatePulses(dt: number): void {
    for (let index = this.pulses.length - 1; index >= 0; index -= 1) {
      const pulse = this.pulses[index];
      if (pulse == null) {
        continue;
      }
      pulse.t += dt;
      const progress = clamp(pulse.t / pulse.duration, 0, 1);
      const scale = 1 + Math.sin(Math.PI * progress) * pulse.amount;
      pulse.object.scale.set(
        pulse.base.x * scale,
        pulse.base.y * scale,
        pulse.base.z * scale,
      );
      if (progress >= 1) {
        pulse.object.scale.copy(pulse.base);
        this.pulses.splice(index, 1);
      }
    }
  }

  private updateTweens(dt: number): void {
    for (let index = this.tweens.length - 1; index >= 0; index -= 1) {
      const tween = this.tweens[index];
      if (tween == null) {
        continue;
      }
      tween.t += dt;
      const progress = clamp(tween.t / tween.duration, 0, 1);
      const eased = easeInOutCubic(progress);
      tween.object.position.set(
        tween.from.x + (tween.to.x - tween.from.x) * eased,
        tween.from.y + (tween.to.y - tween.from.y) * eased,
        tween.from.z + (tween.to.z - tween.from.z) * eased,
      );
      if (progress >= 1) {
        tween.object.position.copy(tween.to);
        this.tweens.splice(index, 1);
        tween.done?.();
      }
    }
  }

  private updateHintBillboard(dt: number): void {
    const hint = this.scene.hint.group;
    hint.position.y = LAYOUT.hint.y + Math.sin(this.elapsed * 0.9) * 0.006;
    hint.lookAt(this.headPosition);
    void dt;
  }

  private detectProgress(): void {
    const current = this.puzzle.solvedCount;
    if (current === this.lastSolvedCount) {
      return;
    }
    const mechanisms: MechanismId[] = ['dial', 'drawer', 'orrery'];
    for (const mechanism of mechanisms) {
      const solved = this.puzzle.isSolved(mechanism);
      if (solved && !this.lastSolved[mechanism]) {
        this.lastSolved[mechanism] = true;
        if (mechanism === 'drawer') {
          this.audio.play('success', this.cueAt(this.scene.drawer.group.position));
          this.setHint('Place each world in its matching orbit');
          this.spawnPulse(this.scene.drawer.group, 0.2, 0.5);
        }
        if (mechanism === 'orrery') {
          this.audio.play('success', this.cueAt(this.scene.orrery.group.position));
          this.setHint('The lantern is waking…');
          this.spawnPulse(this.scene.orrery.group, 0.15, 0.6);
        }
      }
    }
    this.lastSolvedCount = current;
    this.audio.setProgress(current / 3);
  }

  // ---------------------------------------------------------------- helpers ---

  private spawnPulse(object: Object3D, amount: number, duration: number): void {
    if (amount <= 0 || duration <= 0) {
      return;
    }
    this.pulses.push({
      object,
      base: object.scale.clone(),
      t: 0,
      duration,
      amount,
    });
  }

  private moveTo(object: Object3D, target: Vector3, duration: number): void {
    this.tweens.push({
      object,
      from: object.position.clone(),
      to: target.clone(),
      t: 0,
      duration,
    });
  }

  private cueAt(position: { x: number; y: number; z: number }): {
    x: number;
    y: number;
    z: number;
  } {
    return { x: position.x, y: position.y, z: position.z };
  }

  private setHint(text: string): void {
    if (text === this.hintText) {
      return;
    }
    this.hintText = text;
    this.renderHintTexture(false);
  }

  private renderHintTexture(force: boolean): void {
    const hint = this.scene.hint;
    if (!force && this.hintText === '') {
      return;
    }
    hint.texture.dispose();
    const generated = createTextTexture(this.hintText, {
      width: 1024,
      height: 160,
      fontSize: 62,
      color: this.theme.isHighContrast ? '#ffffff' : '#f6e7c8',
      glow: this.theme.isHighContrast
        ? 'rgba(255,255,255,0.6)'
        : 'rgba(255,190,110,0.5)',
    });
    const material = hint.mesh.material as MeshBasicMaterial;
    material.map = generated.texture;
    material.needsUpdate = true;
    hint.texture = generated.texture;
    void this.gazeRingVisible;
  }

  /** Restart the experience without a page reload (soft reset affordance). */
  restart(): void {
    this.puzzle.reset();
    this.lastSolvedCount = 0;
    this.lastSolved.dial = false;
    this.lastSolved.drawer = false;
    this.lastSolved.orrery = false;
    this.lanternLevel = 0;
    this.finaleActive = false;
    this.finaleT = 0;
    this.finaleHintShown = false;
    this.removeRestartAffordance();
    this.restartWasGrabbed = false;

    for (const ring of this.scene.dial.rings) {
      ring.locked = false;
      ring.wasGrabbed = false;
      ring.group.rotation.set(0, 0, 0);
      if (!ring.entity.hasComponent(OneHandGrabbable)) {
        ring.entity.addComponent(OneHandGrabbable, {
          rotate: true,
          translate: false,
          rotateMin: [0, -Math.PI, 0],
          rotateMax: [0, Math.PI, 0],
        });
      }
    }

    const drawer = this.scene.drawer;
    drawer.revealed = false;
    drawer.solvedLocked = false;
    drawer.wasGrabbed = false;
    drawer.boltWasGrabbed = false;
    drawer.group.position.copy(LAYOUT.drawerClosed);
    drawer.boltGroup.position.set(BOLT_HOME_X, 0.022, 0.02);
    if (drawer.boltEnabled) {
      drawer.boltEntity.removeComponent(OneHandGrabbable);
      drawer.boltEnabled = false;
    }
    if (!drawer.entity.hasComponent(OneHandGrabbable)) {
      drawer.entity.addComponent(OneHandGrabbable, {
        rotate: false,
        translate: true,
        translateMin: [LAYOUT.drawerClosed.x, LAYOUT.drawerClosed.y, LAYOUT.drawerClosed.z],
        translateMax: [
          LAYOUT.drawerClosed.x,
          LAYOUT.drawerClosed.y,
          LAYOUT.drawerClosed.z + LAYOUT.drawerTravel,
        ],
      });
    }

    for (const planet of this.scene.orrery.planets) {
      planet.locked = false;
      planet.wasGrabbed = false;
      planet.tween = undefined;
      planet.mesh.position.copy(planet.home);
      if (!planet.entity.hasComponent(OneHandGrabbable)) {
        planet.entity.addComponent(OneHandGrabbable, {
          rotate: false,
          translate: true,
          translateMin: [-0.12, 0.7, -0.95],
          translateMax: [0.5, 0.94, -0.26],
        });
      }
    }

    const lantern = this.scene.lantern;
    lantern.cap.position.set(0, 0.29, 0);
    lantern.cap.rotation.set(0, 0, 0);
    lantern.petals.forEach((petal) => {
      petal.rotation.x = 0;
    });
    this.scene.fireflies.active = false;
    this.scene.fireflies.points.visible = false;
    this.scene.fireflies.t = 0;
    this.scene.reticle.group.visible = false;
    this.gazeDwell = 0;
    this.gazeTargetKind = null;

    this.setHint(INITIAL_HINT);
    this.audio.play('thunk', this.cueAt(LAYOUT.lantern));
    this.audio.setProgress(0);
    this.refreshSettingsIndicators();
  }

  /**
   * Development/QA helper: drive the puzzle to its solved state and mirror it
   * in the meshes. Used by the screenshot script and manual checks only — it is
   * never reachable from the experience's own UI.
   */
  debugSolveAll(): void {
    const rings = this.scene.dial.rings;
    const targets = TARGET_ANGLES;
    rings.forEach((ring, index) => {
      const target = targets[index] ?? 0;
      this.puzzle.setRingAngle(ring.index, target);
      if (!ring.locked) {
        this.lockRing(ring, target);
      }
    });
    this.puzzle.snapDialIfClose();

    const drawer = this.scene.drawer;
    this.puzzle.pullDrawer(LAYOUT.drawerTravel);
    drawer.group.position.z = LAYOUT.drawerClosed.z + LAYOUT.drawerTravel;
    if (!drawer.revealed) {
      drawer.revealed = true;
      this.enableBolt();
    }
    this.puzzle.slideBolt(this.puzzle.config.drawer.maxBolt);
    drawer.boltGroup.position.x = BOLT_HOME_X + this.puzzle.config.drawer.maxBolt;

    for (const planet of this.scene.orrery.planets) {
      this.puzzle.placePlanet(planet.id, planet.targetSlot);
      const slot = this.scene.orrery.slots.find((candidate) => candidate.index === planet.targetSlot);
      if (slot != null) {
        planet.mesh.position.copy(slot.position);
        if (!planet.locked) {
          planet.locked = true;
          planet.entity.removeComponent(OneHandGrabbable);
        }
      }
    }
  }

  /** Serialise a compact debug snapshot for the README / manual checks. */
  debugState(): Record<string, unknown> {
    return {
      solvedCount: this.puzzle.solvedCount,
      lanternOpen: this.puzzle.lanternOpen,
      highContrast: this.theme.isHighContrast,
      gentleMotion: this.gentleMotion,
      gazeAssist: this.gazeAssist,
      hint: this.hintText,
      dial: this.puzzle.snapshot().dial,
      drawer: this.puzzle.snapshot().drawer,
      orrery: this.puzzle.snapshot().orrery,
      orbitSlots: ORBIT_SLOTS,
    };
  }
}
