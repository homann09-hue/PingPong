import { DeterministicRng } from "./rng.js";
import type { EngineEvent, LineWin, ScatterWin, SlotConfig, SpinRequest, SpinResult, SpinRound, WaysWin, Win } from "./types.js";

/** Pure deterministic evaluator and bounded feature state machine. */
export class SlotEngine {
  public constructor(private readonly config: SlotConfig) {}

  public spin(request: SpinRequest): SpinResult {
    if (!Number.isSafeInteger(request.bet) || request.bet <= 0) throw new RangeError("bet must be a positive integer");
    if (this.config.bet && !this.config.bet.steps.includes(request.bet)) {
      throw new RangeError("bet must match a configured stake step");
    }
    if (request.bonusBuy && !this.config.features?.bonusBuy) throw new RangeError("bonus buy is not configured for this game");
    const rng = new DeterministicRng(request.seed);
    const stops = this.config.reels.map((strip) => rng.nextInt(strip.length));
    const baseGrid = this.gridFromStops(stops);
    const rounds: SpinRound[] = [];
    let freeSpinsRemaining = 0;
    let freeSpinsPlayed = 0;
    const stickyCells = new Set<string>();

    const base = this.playPrimary("base", 0, baseGrid, request.bet, rng, rounds);
    this.playConfiguredBonus(base.grid, request.bet, rng, rounds, request.bonusBuy === true);
    this.playCoinCollect(base.grid, request.bet, rng, rounds);
    this.playJackpot(base.grid, request.bet, rounds);
    this.playRespins(base.grid, request.bet, rng, rounds);
    freeSpinsRemaining += this.freeSpinAward(base.grid);
    if (freeSpinsRemaining > 0) base.events.push(this.awardEvent(freeSpinsRemaining));

    const maximum = this.config.features?.freeSpins?.maxTotal ?? 0;
    while (freeSpinsRemaining > 0 && freeSpinsPlayed < maximum) {
      freeSpinsRemaining--;
      freeSpinsPlayed++;
      const stickyEvents: EngineEvent[] = [];
      const configuredReels = this.config.features?.freeSpins?.reelStrips ?? this.config.reels;
      const modifiedGrid = this.applyFreeSpinModifiers(this.randomGrid(rng, configuredReels), rng, stickyEvents);
      const freeGrid = this.applyStickyWild(modifiedGrid, stickyCells, stickyEvents);
      const freeMultiplier = this.config.features?.freeSpins?.winMultiplier ?? 1;
      const round = this.playPrimary("free_spin", freeSpinsPlayed, freeGrid, request.bet, rng, rounds, stickyEvents, freeMultiplier);
      this.playCoinCollect(round.grid, request.bet, rng, rounds);
      const retrigger = this.freeSpinAward(round.grid);
      const accepted = Math.min(retrigger, maximum - freeSpinsPlayed - freeSpinsRemaining);
      if (accepted > 0) { freeSpinsRemaining += accepted; round.events.push(this.awardEvent(accepted)); }
    }

    const { rounds: settledRounds, maxWinReached } = this.applyMaxWin(rounds, request.bet);
    const wins = settledRounds.flatMap((round) => round.wins);
    const totalWin = settledRounds.reduce((sum, round) => sum + round.totalWin, 0);
    const winClass = this.winClass(totalWin, request.bet, maxWinReached);
    return {
      configId: this.config.id, configVersion: this.config.version,
      mathModelVersion: this.config.math.mathModelVersion, seed: request.seed.toString(),
      baseBet: request.bet,
      wager: request.bet * (request.bonusBuy ? this.config.features!.bonusBuy!.costMultiplier : 1),
      bonusBuy: request.bonusBuy === true,
      stops, grid: settledRounds[0]!.grid, wins, rounds: settledRounds, freeSpinsPlayed,
      totalWin,
      maxWinReached,
      maxWinMultiplier: this.config.math.maxWinMultiplier,
      ...(winClass ? { winClass } : {}),
    };
  }

  private applyMaxWin(rounds: readonly SpinRound[], bet: number): { rounds: SpinRound[]; maxWinReached: boolean } {
    const limit = bet * this.config.math.maxWinMultiplier;
    let remaining = limit;
    const settled: SpinRound[] = [];
    for (const round of rounds) {
      if (round.totalWin < remaining) {
        settled.push(round);
        remaining -= round.totalWin;
        continue;
      }
      const cappedWins: Win[] = [];
      let roundRemaining = remaining;
      for (const win of round.wins) {
        if (roundRemaining <= 0) break;
        const amount = Math.min(win.amount, roundRemaining);
        cappedWins.push({ ...win, amount });
        roundRemaining -= amount;
      }
      settled.push({
        ...round,
        wins: cappedWins,
        totalWin: remaining,
        events: [...round.events, {
          type: "max_win.reached",
          data: { multiplier: this.config.math.maxWinMultiplier, amount: limit },
        }],
      });
      return { rounds: settled, maxWinReached: true };
    }
    return { rounds: settled, maxWinReached: false };
  }

  private winClass(totalWin: number, bet: number, maxWinReached: boolean): SpinResult["winClass"] {
    if (maxWinReached) return "MAX";
    const ratio = totalWin / bet;
    const configured = this.config.winClasses ?? [
      { name: "SMALL" as const, minimumMultiplier: 1 },
      { name: "NICE" as const, minimumMultiplier: 5 },
      { name: "BIG" as const, minimumMultiplier: 15 },
      { name: "MEGA" as const, minimumMultiplier: 50 },
      { name: "EPIC" as const, minimumMultiplier: 100 },
    ];
    return [...configured].reverse().find((value) => ratio >= value.minimumMultiplier)?.name;
  }

  private playPrimary(
    phase: "base" | "free_spin", index: number, input: string[][], bet: number,
    rng: DeterministicRng, output: SpinRound[], initialEvents: EngineEvent[] = [], winMultiplier = 1,
  ): SpinRound & { events: EngineEvent[] } {
    const events: EngineEvent[] = [...initialEvents];
    if (winMultiplier > 1) events.push({ type: "multiplier.applied", data: { source: "free_spin", multiplier: winMultiplier } });
    const upgraded = this.upgradeSymbols(input, events);
    const revealed = this.revealMystery(upgraded, rng, events);
    this.recordStackedWilds(revealed, events);
    const grid = this.expandWilds(revealed, events);
    const wins = this.evaluateWins(grid, bet, true, events, winMultiplier);
    const round = this.round(phase, index, grid, wins, events);
    output.push(round);

    let current = grid;
    let currentWins = wins;
    const maxSteps = this.config.features?.cascades?.maxSteps ?? 0;
    for (let step = 1; step <= maxSteps; step++) {
      const cells = this.winningPrimaryCells(currentWins);
      if (cells.length === 0) break;
      const cascadeEvents: EngineEvent[] = [{ type: "cascade.started", data: { step } }];
      current = this.refill(current, cells, rng);
      current = this.upgradeSymbols(current, cascadeEvents);
      current = this.revealMystery(current, rng, cascadeEvents);
      this.recordStackedWilds(current, cascadeEvents);
      current = this.expandWilds(current, cascadeEvents);
      const cascadeFeature = this.config.features!.cascades!;
      const cascadeMultiplier = Math.min(
        cascadeFeature.maxMultiplier ?? Number.MAX_SAFE_INTEGER,
        winMultiplier + step * (cascadeFeature.multiplierStep ?? 0),
      );
      if (cascadeMultiplier > 1) {
        cascadeEvents.push({ type: "multiplier.applied", data: { source: "cascade", step, multiplier: cascadeMultiplier } });
      }
      const cascadeWins = this.evaluateWins(current, bet, false, cascadeEvents, cascadeMultiplier);
      output.push(this.round("cascade", step, current, cascadeWins, cascadeEvents));
      if (!cascadeWins.some((win) => win.kind === "line" || win.kind === "ways")) break;
      currentWins = cascadeWins;
    }
    return round;
  }

  private round(phase: SpinRound["phase"], index: number, grid: string[][], wins: Win[], events: EngineEvent[]): SpinRound & { events: EngineEvent[] } {
    return { phase, index, grid, wins, events, totalWin: wins.reduce((sum, win) => sum + win.amount, 0) };
  }

  private gridFromStops(stops: readonly number[]): string[][] {
    return this.config.reels.map((strip, reel) => Array.from({ length: this.config.rows }, (_, row) => strip[(stops[reel]! + row) % strip.length]!));
  }

  private randomGrid(rng: DeterministicRng, reels = this.config.reels): string[][] {
    return reels.map((strip) => {
      const stop = rng.nextInt(strip.length);
      return Array.from({ length: this.config.rows }, (_, row) => strip[(stop + row) % strip.length]!);
    });
  }

  private revealMystery(input: readonly (readonly string[])[], rng: DeterministicRng, events: EngineEvent[]): string[][] {
    const feature = this.config.features?.mysteryReveal;
    const grid = input.map((reel) => [...reel]);
    if (!feature) return grid;
    const cells = grid.flatMap((reel, reelIndex) => reel.flatMap((symbol, row) =>
      symbol === feature.symbol ? [[reelIndex, row] as [number, number]] : [],
    ));
    if (cells.length === 0) return grid;
    const target = feature.targets[rng.nextInt(feature.targets.length)]!;
    for (const [reel, row] of cells) grid[reel]![row] = target;
    events.push({ type: "mystery.revealed", data: { symbol: feature.symbol, target, count: cells.length } });
    return grid;
  }

  private upgradeSymbols(input: readonly (readonly string[])[], events: EngineEvent[]): string[][] {
    const feature = this.config.features?.symbolUpgrade;
    const grid = input.map((reel) => [...reel]);
    if (!feature) return grid;
    const triggerCount = grid.flat().filter((symbol) => symbol === feature.triggerSymbol).length;
    if (triggerCount < feature.minimumCount) return grid;
    const targets = new Map(feature.upgrades.map((upgrade) => [upgrade.from, upgrade.to]));
    const counts = new Map<string, number>();
    for (const reel of grid) {
      for (let row = 0; row < reel.length; row++) {
        const from = reel[row]!;
        const to = targets.get(from);
        if (!to) continue;
        reel[row] = to;
        counts.set(from, (counts.get(from) ?? 0) + 1);
      }
    }
    for (const upgrade of feature.upgrades) {
      const count = counts.get(upgrade.from) ?? 0;
      if (count > 0) {
        events.push({
          type: "symbol.upgraded",
          data: { from: upgrade.from, to: upgrade.to, count, triggerCount },
        });
      }
    }
    return grid;
  }

  private applyFreeSpinModifiers(input: readonly (readonly string[])[], rng: DeterministicRng, events: EngineEvent[]): string[][] {
    const feature = this.config.features?.freeSpins;
    const grid = input.map((reel) => [...reel]);
    if (!feature) return grid;
    const positions = Array.from({ length: this.config.reels.length * this.config.rows }, (_, index) => index);
    const extraWilds = feature.extraWilds;
    if (extraWilds) {
      for (let index = positions.length - 1; index > 0; index--) {
        const swap = rng.nextInt(index + 1);
        [positions[index], positions[swap]] = [positions[swap]!, positions[index]!];
      }
      for (const position of positions.slice(0, extraWilds.count)) {
        const reel = Math.floor(position / this.config.rows);
        const row = position % this.config.rows;
        grid[reel]![row] = extraWilds.symbol;
      }
      events.push({ type: "free_spins.modified", data: { mode: "extra_wilds", symbol: extraWilds.symbol, count: extraWilds.count } });
    }
    if (feature.reelStrips) {
      events.push({ type: "free_spins.modified", data: { mode: "special_reels" } });
    }
    return grid;
  }

  private expandWilds(input: readonly (readonly string[])[], events: EngineEvent[]): string[][] {
    const grid = input.map((reel) => [...reel]);
    const expanding = new Set(this.config.features?.expandingWild?.symbols ?? []);
    grid.forEach((reel, reelIndex) => {
      const symbol = reel.find((value) => expanding.has(value));
      if (symbol) { grid[reelIndex] = Array(this.config.rows).fill(symbol) as string[]; events.push({ type: "wild.expanded", data: { reel: reelIndex, symbol } }); }
    });
    return grid;
  }

  private recordStackedWilds(input: readonly (readonly string[])[], events: EngineEvent[]): void {
    const feature = this.config.features?.stackedWild;
    if (!feature) return;
    for (let reel = 0; reel < input.length; reel++) {
      let row = 0;
      while (row < input[reel]!.length) {
        if (input[reel]![row] !== feature.symbol) { row++; continue; }
        const startRow = row;
        while (row < input[reel]!.length && input[reel]![row] === feature.symbol) row++;
        const size = row - startRow;
        if (size >= feature.minimumSize) {
          events.push({ type: "wild.stacked", data: { reel, startRow, size, symbol: feature.symbol } });
        }
      }
    }
  }

  private applyStickyWild(input: readonly (readonly string[])[], stickyCells: Set<string>, events: EngineEvent[]): string[][] {
    const feature = this.config.features?.stickyWild;
    const grid = input.map((reel) => [...reel]);
    if (!feature) return grid;
    for (const key of stickyCells) {
      const parts = key.split(":");
      const reel = Number(parts[0]!);
      const row = Number(parts[1]!);
      grid[reel]![row] = feature.symbol;
    }
    for (let reel = 0; reel < grid.length && stickyCells.size < feature.maxSticky; reel++) {
      for (let row = 0; row < grid[reel]!.length && stickyCells.size < feature.maxSticky; row++) {
        if (grid[reel]![row] === feature.symbol) stickyCells.add(`${reel}:${row}`);
      }
    }
    if (stickyCells.size > 0) events.push({ type: "wild.stuck", data: { count: stickyCells.size, symbol: feature.symbol } });
    return grid;
  }

  private playRespins(baseGrid: readonly (readonly string[])[], bet: number, rng: DeterministicRng, rounds: SpinRound[]): void {
    const walking = this.config.features?.walkingWild;
    if (walking) {
      let cells = baseGrid.flatMap((reel, reelIndex) => reel.flatMap((symbol, row) => symbol === walking.symbol ? [[reelIndex, row] as [number, number]] : []));
      for (let step = 1; step <= walking.maxSteps && cells.length > 0; step++) {
        cells = cells
          .map(([reel, row]) => [reel + (walking.direction === "right" ? 1 : -1), row] as [number, number])
          .filter(([reel]) => reel >= 0 && reel < this.config.reels.length);
        if (cells.length === 0) break;
        const events: EngineEvent[] = [{ type: "respin.started", data: { index: step } }, { type: "wild.walked", data: { step, count: cells.length, symbol: walking.symbol } }];
        const grid = this.revealMystery(this.randomGrid(rng), rng, events);
        for (const [reel, row] of cells) grid[reel]![row] = walking.symbol;
        const wins = this.evaluateWins(grid, bet, true, events);
        rounds.push(this.round("respin", step, grid, wins, events));
      }
    }

    const respins = this.config.features?.respins;
    if (!respins) return;
    const triggers = baseGrid.flat().filter((symbol) => symbol === respins.triggerSymbol).length;
    if (triggers < respins.minimumCount) return;
    for (let index = 1; index <= respins.count; index++) {
      const events: EngineEvent[] = [{ type: "respin.started", data: { index, triggerCount: triggers } }];
      const grid = this.revealMystery(this.randomGrid(rng), rng, events);
      const wins = this.evaluateWins(grid, bet, true, events);
      rounds.push(this.round("respin", index, grid, wins, events));
    }
  }

  private evaluateWins(
    grid: readonly (readonly string[])[], bet: number, includeScatter: boolean,
    events: EngineEvent[], roundMultiplier = 1,
  ): Win[] {
    const wins: Win[] = this.config.features?.ways
      ? this.evaluateWays(grid, bet, events, roundMultiplier)
      : this.evaluateLines(grid, bet, events, roundMultiplier);
    if (!includeScatter) return wins;
    for (const [symbol, definition] of Object.entries(this.config.symbols)) {
      if (definition.kind !== "scatter") continue;
      const cells = grid.flatMap((reel, reelIndex) => reel.flatMap((value, row) => value === symbol ? [[reelIndex, row] as [number, number]] : []));
      const multiplier = definition.payouts[cells.length] ?? 0;
      if (cells.length > 0) events.push({ type: "scatter.hit", data: { symbol, count: cells.length } });
      if (multiplier > 0) wins.push({
        kind: "scatter", symbol, count: cells.length,
        amount: multiplier * bet * roundMultiplier, cells,
      } satisfies ScatterWin);
    }
    return wins;
  }

  private evaluateLines(
    grid: readonly (readonly string[])[], bet: number, events: EngineEvent[], roundMultiplier: number,
  ): LineWin[] {
    const wilds = new Set(Object.entries(this.config.symbols).filter(([, value]) => value.kind === "wild").map(([key]) => key));
    return this.config.paylines.flatMap((line, payline) => {
      const values = line.map((row, reel) => grid[reel]![row]!);
      const left = this.evaluateLineDirection(values, line, payline, "left", bet, wilds, events, roundMultiplier);
      if (!this.config.features?.bothWays) return left ? [left] : [];
      const right = this.evaluateLineDirection(
        [...values].reverse(), [...line].reverse(), payline, "right", bet, wilds, events, roundMultiplier,
      );
      if (left && right && left.symbol === right.symbol && left.count === values.length && right.count === values.length) return [left];
      return [left, right].filter((win): win is LineWin => win !== null);
    });
  }

  private evaluateWays(
    grid: readonly (readonly string[])[], bet: number, events: EngineEvent[], roundMultiplier: number,
  ): WaysWin[] {
    const feature = this.config.features!.ways!;
    const wilds = new Set(Object.entries(this.config.symbols).filter(([, value]) => value.kind === "wild").map(([key]) => key));
    const regulars = Object.entries(this.config.symbols)
      .filter(([, definition]) => definition.kind === "regular")
      .map(([symbol]) => symbol);
    const candidates = regulars.length > 0 ? regulars : [...wilds];
    const wins: WaysWin[] = [];
    for (const candidate of candidates) {
      const candidateIsWild = wilds.has(candidate);
      const cellsByReel: [number, number][][] = [];
      for (let reel = 0; reel < grid.length; reel++) {
        const matches = grid[reel]!.flatMap((symbol, row) =>
          symbol === candidate || (!candidateIsWild && wilds.has(symbol)) ? [[reel, row] as [number, number]] : [],
        );
        if (matches.length === 0) break;
        cellsByReel.push(matches);
      }
      const count = cellsByReel.length;
      if (count < feature.minimumReels) continue;
      if (!candidateIsWild && !cellsByReel.some((cells) => cells.some(([reel, row]) => grid[reel]![row] === candidate))) continue;
      const payout = this.config.symbols[candidate]?.payouts[count] ?? 0;
      if (payout <= 0) continue;
      const ways = cellsByReel.reduce((product, cells) => product * cells.length, 1);
      const amount = Math.floor((payout * bet * ways * roundMultiplier) / feature.betDivisor);
      if (amount <= 0) continue;
      wins.push({ kind: "ways", symbol: candidate, count, ways, amount, cells: cellsByReel.flat() });
      events.push({ type: "ways.win", data: { symbol: candidate, count, ways } });
    }
    return wins;
  }

  private evaluateLineDirection(
    values: readonly string[], rows: readonly number[], payline: number, direction: "left" | "right",
    bet: number, wilds: ReadonlySet<string>, events: EngineEvent[], roundMultiplier: number,
  ): LineWin | null {
      const firstRegular = values.find((symbol) => !wilds.has(symbol));
      const candidates = new Set<string>();
      if (firstRegular && this.config.symbols[firstRegular]?.kind === "regular") candidates.add(firstRegular);
      for (const wild of wilds) candidates.add(wild);
      let best: { symbol: string; count: number; pay: number } | null = null;
      for (const candidate of candidates) {
        const candidateIsWild = wilds.has(candidate);
        let count = 0;
        while (count < values.length && (
          values[count] === candidate || (!candidateIsWild && wilds.has(values[count]!))
        )) count++;
        const pay = this.config.symbols[candidate]?.payouts[count] ?? 0;
        if (pay > 0 && (!best || pay > best.pay || (pay === best.pay && count > best.count))) {
          best = { symbol: candidate, count, pay };
        }
      }
      if (!best) return null;
      const feature = this.config.features?.wildMultiplier;
      const wildCount = feature
        ? values.slice(0, best.count).filter((symbol) => symbol === feature.symbol).length
        : 0;
      const winMultiplier = feature && wildCount > 0
        ? Math.min(feature.maxTotalMultiplier, feature.multiplier ** wildCount)
        : 1;
      if (winMultiplier > 1) {
        events.push({
          type: "multiplier.applied",
          data: { payline, direction, symbol: feature!.symbol, wildCount, multiplier: winMultiplier },
        });
      }
      const rawAmount = best.pay * bet * winMultiplier * roundMultiplier;
      const cells = rows.slice(0, best.count).map((row, index) => {
        const reel = direction === "left" ? index : this.config.reels.length - 1 - index;
        return [reel, row] as [number, number];
      });
      return {
        kind: "line", payline, direction, symbol: best.symbol, count: best.count,
        amount: Math.floor(rawAmount / this.config.paylines.length), cells,
      };
  }

  private winningPrimaryCells(wins: readonly Win[]): [number, number][] {
    return [...new Map(wins.filter((win) => win.kind === "line" || win.kind === "ways").flatMap((win) => win.cells).map((cell) => [cell.join(":"), cell])).values()];
  }

  private refill(grid: readonly (readonly string[])[], cells: readonly [number, number][], rng: DeterministicRng): string[][] {
    const removedByReel = new Map<number, Set<number>>();
    for (const [reel, row] of cells) {
      const removed = removedByReel.get(reel) ?? new Set<number>();
      removed.add(row);
      removedByReel.set(reel, removed);
    }
    return grid.map((reel, reelIndex) => {
      const removed = removedByReel.get(reelIndex) ?? new Set<number>();
      const survivors = reel.filter((_, row) => !removed.has(row));
      const strip = this.config.reels[reelIndex]!;
      const replacements = Array.from({ length: removed.size }, () => strip[rng.nextInt(strip.length)]!);
      return [...replacements, ...survivors];
    });
  }

  private freeSpinAward(grid: readonly (readonly string[])[]): number {
    const feature = this.config.features?.freeSpins;
    if (!feature) return 0;
    const count = grid.flat().filter((symbol) => symbol === feature.scatterSymbol).length;
    return feature.awards[count] ?? 0;
  }

  private playPickBonus(grid: readonly (readonly string[])[], bet: number, rng: DeterministicRng, rounds: SpinRound[]): void {
    const feature = this.config.features?.pickBonus;
    if (!feature) return;
    const count = grid.flat().filter((symbol) => symbol === feature.scatterSymbol).length;
    if (count < feature.minimumCount) return;
    const multiplier = feature.multipliers[rng.nextInt(feature.multipliers.length)]!;
    const amount = multiplier * bet;
    rounds.push({
      phase: "bonus",
      index: 0,
      grid: grid.map((reel) => [...reel]),
      wins: [],
      totalWin: amount,
      events: [{ type: "bonus.awarded", data: { amount, multiplier, mode: "pick" } }],
    });
  }

  private playConfiguredBonus(grid: readonly (readonly string[])[], bet: number, rng: DeterministicRng, rounds: SpinRound[], force = false): void {
    if (this.config.features?.pickBonus) {
      if (force) {
        const feature = this.config.features.pickBonus;
        const multiplier = feature.multipliers[rng.nextInt(feature.multipliers.length)]!;
        this.pushBonusRound(grid, multiplier * bet, multiplier, "pick", rounds, {});
      } else {
        this.playPickBonus(grid, bet, rng, rounds);
      }
      return;
    }
    const wheel = this.config.features?.wheelBonus;
    if (wheel) {
      const count = grid.flat().filter((symbol) => symbol === wheel.scatterSymbol).length;
      if (!force && count < wheel.minimumCount) return;
      const segment = rng.nextInt(wheel.multipliers.length);
      const multiplier = wheel.multipliers[segment]!;
      this.pushBonusRound(grid, multiplier * bet, multiplier, "wheel", rounds, { segment });
      return;
    }
    const hold = this.config.features?.holdAndWinBonus;
    if (!hold) return;
    const count = grid.flat().filter((symbol) => symbol === hold.scatterSymbol).length;
    if (!force && count < hold.minimumCount) return;
    const boardSize = this.config.reels.length * this.config.rows;
    const spots = hold.spotRange[0] + rng.nextInt(hold.spotRange[1] - hold.spotRange[0] + 1);
    const positions = Array.from({ length: boardSize }, (_, index) => index);
    for (let index = positions.length - 1; index > 0; index--) {
      const swap = rng.nextInt(index + 1);
      [positions[index], positions[swap]] = [positions[swap]!, positions[index]!];
    }
    const awards = positions.slice(0, spots).map((position) => ({
      position,
      multiplier: hold.multipliers[rng.nextInt(hold.multipliers.length)]!,
    }));
    const multiplier = awards.reduce((sum, award) => sum + award.multiplier, 0);
    const initialCount = Math.min(hold.minimumCount, awards.length);
    const initial = awards.slice(0, initialCount);
    const pending = awards.slice(initialCount);
    const steps: { lives: number; awards: typeof pending }[] = [];
    let cursor = 0;
    let lives = 3;
    while (cursor < pending.length) {
      const misses = rng.nextInt(3);
      for (let miss = 0; miss < misses; miss++) {
        lives--;
        steps.push({ lives, awards: [] });
      }
      const revealCount = Math.min(1 + rng.nextInt(3), pending.length - cursor);
      const revealed = pending.slice(cursor, cursor + revealCount);
      cursor += revealCount;
      lives = 3;
      steps.push({ lives, awards: revealed });
    }
    while (lives > 0) {
      lives--;
      steps.push({ lives, awards: [] });
    }
    const encode = (values: readonly { position: number; multiplier: number }[]) =>
      values.map((value) => `${value.position}=${value.multiplier}`).join(",");
    const encodedSteps = steps.map((step) => `${step.lives}:${encode(step.awards)}`).join(";");
    this.pushBonusRound(grid, multiplier * bet, multiplier, "hold_and_win", rounds, {
      spots,
      respins: 3,
      boardSize,
      initialSpots: encode(initial),
      respinSteps: encodedSteps,
    });
  }

  private playCoinCollect(
    grid: readonly (readonly string[])[], bet: number, rng: DeterministicRng, rounds: SpinRound[],
  ): void {
    const feature = this.config.features?.coinCollect;
    if (!feature) return;
    const collectorCount = grid.flat().filter((symbol) => symbol === feature.collectorSymbol).length;
    if (collectorCount === 0) return;
    const positions = grid.flatMap((reel, reelIndex) => reel.flatMap((symbol, row) =>
      symbol === feature.coinSymbol ? [reelIndex * this.config.rows + row] : [],
    ));
    if (positions.length < feature.minimumCoins) return;
    const coins = positions.map((position) => ({
      position,
      multiplier: feature.multipliers[rng.nextInt(feature.multipliers.length)]!,
    }));
    const multiplier = coins.reduce((sum, coin) => sum + coin.multiplier, 0);
    const encoded = coins.map((coin) => `${coin.position}=${coin.multiplier}`).join(",");
    this.pushBonusRound(grid, multiplier * bet, multiplier, "coin_collect", rounds, {
      coinCount: coins.length,
      collectorCount,
      coins: encoded,
    });
  }

  private pushBonusRound(
    grid: readonly (readonly string[])[], amount: number, multiplier: number, mode: string,
    rounds: SpinRound[], extra: Readonly<Record<string, number | string>>,
  ): void {
    rounds.push({
      phase: "bonus", index: 0, grid: grid.map((reel) => [...reel]), wins: [], totalWin: amount,
      events: [{ type: "bonus.awarded", data: { amount, multiplier, mode, ...extra } }],
    });
  }

  private playJackpot(grid: readonly (readonly string[])[], bet: number, rounds: SpinRound[]): void {
    const feature = this.config.features?.jackpots;
    if (!feature) return;
    const count = grid.flat().filter((symbol) => symbol === feature.scatterSymbol).length;
    const tier = [...feature.tiers]
      .filter((value) => count >= value.minimumCount)
      .sort((a, b) => b.minimumCount - a.minimumCount)[0];
    if (!tier) return;
    this.pushBonusRound(grid, tier.multiplier * bet, tier.multiplier, "jackpot", rounds, {
      tier: tier.name,
      scatterCount: count,
    });
  }

  private awardEvent(count: number): EngineEvent { return { type: "free_spins.awarded", data: { count } }; }
}
