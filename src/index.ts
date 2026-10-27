/**
 * The Lantern Room — application entry point.
 *
 * IWSDK owns the renderer, WebXR session, input rig and ECS. `projectOptions`
 * comes from the `virtual:iwsdk-project` module that `@iwsdk/vite-plugin-dev`
 * derives from `iwsdk.config.json`; those options are what enable hand tracking,
 * the grab system, and the IWER desktop emulator on localhost.
 */
import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { LanternRoom } from './scene/room.js';
import { bindLanternRoom, LanternRoomSystem } from './systems/lantern-room-system.js';

const container = document.getElementById('scene-container');
const bootFallback = document.getElementById('boot-fallback');
const bootNote = document.getElementById('boot-note');

if (!(container instanceof HTMLDivElement)) {
  throw new Error('The Lantern Room requires a #scene-container element.');
}

World.create(container, projectOptions)
  .then((world) => {
    world.registerSystem(LanternRoomSystem);
    const room = new LanternRoom(world);
    bindLanternRoom(room);

    bootFallback?.classList.add('hidden');
    if (bootNote != null) {
      bootNote.textContent = '';
    }

    // Expose the room for manual verification in the browser console and for
    // the optional Playwright screenshot/check script.
    (window as unknown as { __lanternRoom?: LanternRoom }).__lanternRoom = room;
    console.info('[The Lantern Room] ready — pinch a ring to begin.');
  })
  .catch((error: unknown) => {
    console.error('[The Lantern Room] failed to start', error);
    if (bootNote != null) {
      bootNote.textContent =
        'Startup error — see the browser console for details.';
    }
  });
