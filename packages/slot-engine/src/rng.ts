import type { RngSeed } from "./types.js";

const MASK_64 = (1n << 64n) - 1n;
const UINT64_RANGE = 1n << 64n;

/** Deterministic SplitMix64 generator. Never use client-provided seeds in production. */
export class DeterministicRng {
  private state: bigint;

  public constructor(seed: RngSeed) {
    this.state = seed & MASK_64;
  }

  public nextUint64(): bigint {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & MASK_64;
    let value = this.state;
    value = ((value ^ (value >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK_64;
    value = ((value ^ (value >> 27n)) * 0x94d049bb133111ebn) & MASK_64;
    return (value ^ (value >> 31n)) & MASK_64;
  }

  public nextInt(exclusiveMax: number): number {
    if (!Number.isSafeInteger(exclusiveMax) || exclusiveMax <= 0) {
      throw new RangeError("exclusiveMax must be a positive safe integer");
    }
    const bound = BigInt(exclusiveMax);
    const unbiasedLimit = UINT64_RANGE - (UINT64_RANGE % bound);
    let value: bigint;
    do {
      value = this.nextUint64();
    } while (value >= unbiasedLimit);
    return Number(value % bound);
  }
}
