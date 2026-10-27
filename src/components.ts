/**
 * The Lantern Room — ECS component catalog.
 *
 * The room is procedural and drives its own state with plain TypeScript, so no
 * custom ECS components are declared. Built-in IWSDK components (Transform,
 * OneHandGrabbable, Grabbed, AudioSource, …) are registered by the runtime.
 *
 * Keeping this file (even empty) satisfies `iwsdk.config.json`'s component
 * module contract and leaves a clear place to add authored components later.
 */
import { defineComponents } from '@iwsdk/core';

export default defineComponents([]);
