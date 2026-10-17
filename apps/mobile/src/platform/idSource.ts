import { randomUUID } from 'expo-crypto';
import { worldId, type IdSource } from '@sport-sim/sim-core';

/**
 * The only impure input to world creation: a platform-random world id. It never touches
 * gameplay randomness; the simulation's RNG comes solely from the seed.
 */
export const platformIdSource: IdSource = {
  newWorldId: () => worldId(`world-${randomUUID()}`),
};