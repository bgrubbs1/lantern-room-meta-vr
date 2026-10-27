/**
 * The Lantern Room — ECS system bridge.
 *
 * All of the room's behaviour lives in the plain `LanternRoom` class so it can
 * be reasoned about and unit-tested without an ECS. This tiny system just ticks
 * it with the player/input context that IWSDK wires up for systems. Systems are
 * registered by class, so the active room instance is bound through a module
 * singleton at startup.
 */
import { createSystem } from '@iwsdk/core';
import type { LanternRoom } from '../scene/room.js';

let activeRoom: LanternRoom | undefined;

/** Bind the room instance created after `World.create` resolves. */
export function bindLanternRoom(room: LanternRoom): void {
  activeRoom = room;
}

export class LanternRoomSystem extends createSystem({}) {
  override update(delta: number, time: number): void {
    activeRoom?.update(delta, time);
  }
}
