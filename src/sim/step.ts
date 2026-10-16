import { AGES } from '../data/ages';
import { CATCHUP_PER_AGE, CHARGE_BONUS, CRIT_CHANCE, CRIT_MULT, DAMAGE_VARIANCE, DEFENDER_GOLD_MULT, LANE_LENGTH, LAST_STAND_HP, MINE_INCOME, OVERTIME_AFTER_SEC, OVERTIME_BASE_DAMAGE_MAX, OVERTIME_RAMP_SEC, OVERTIME_UNIT_DAMAGE_MAX, OVERTIME_TURRET_MIN, PASSIVE_GOLD, SLOT_HEIGHTS, SLOW_ATTACK_SHARE, SPECIAL_ACCURACY, SPECIAL_FALLOFF, SPECIAL_SCATTER, SPECIAL_VARIANCE, SPAWN_CLEARANCE, SUDDEN_DEATH_AFTER_SEC, SUDDEN_DEATH_DECAY, TICK_RATE, TURRET_AGE_UPGRADE, XP_PER_DAMAGE, DEFENDER_XP_MULT, sec } from '../data/config';
import { SPECIALS } from '../data/specials';
import { TURRETS } from '../data/turrets';
import { UNITS, type Role } from '../data/units';
import { nextRandom } from './rng';
import { baseFront, dirOf, enemyOf } from './state';
import type { GameState, Side, SimEvent, Unit } from './types';

export const UNIT_SY = 26; // visual height of a unit's weapon above the ground
export const UNIT_TY = 20; // visual height of a unit's body centre
export const turretHeight = (slot: number): number => SLOT_HEIGHTS[slot] + 22;
const STRIKE_DELAY_TICKS = Math.round(0.5 * TICK_RATE);
const SPACING = 0.82;

interface Attack {
  u: Unit;
  targetId: number; // -1 = enemy base
  charge: boolean;
}

/** 0..1: how far into overtime the match is (anti-stalemate). */
export const overtime = (s: GameState): number => Math.min(1, Math.max(0, (s.tick / TICK_RATE - OVERTIME_AFTER_SEC) / OVERTIME_RAMP_SEC));

/** Catch-up multiplier on XP and income for a player who is behind the opponent in age. */
export const catchup = (s: GameState, side: Side): number => 1 + CATCHUP_PER_AGE * Math.max(0, s.players[enemyOf(side)].age - s.players[side].age);

const bonusVs = (bonus: Partial<Record<Role, number>> | undefined, target: Unit): number => bonus?.[UNITS[target.def].role] ?? 1;

/** Rolls a hit: +-DAMAGE_VARIANCE spread and a chance to crit. */
function roll(s: GameState, base: number): { dmg: number; crit: boolean } {
  const dmg = base * (1 + (nextRandom(s) * 2 - 1) * DAMAGE_VARIANCE);
  const crit = nextRandom(s) < CRIT_CHANCE;
  return { dmg: crit ? dmg * CRIT_MULT : dmg, crit };
}

/** Removes and returns the events produced since the last drain (controllers call this after commands/steps). */
export function drainEvents(s: GameState): SimEvent[] {
  return s.events.splice(0, s.events.length);
}

/** Advances the simulation by exactly one tick. Pure function of (state): no randomness except state.rng. */
export function step(s: GameState): void {
  if (s.winner !== null) return;
  s.tick++;

  incomePhase(s);
  trainingPhase(s);
  unitPhase(s);
  turretPhase(s);
  projectilePhase(s);
  specialPhase(s);
  reapPhase(s);

  const [a, b] = s.players;
  if (a.baseHp <= 0 || b.baseHp <= 0) {
    // Both can fall on the same tick (sudden death): more HP left wins, then more damage dealt.
    s.winner = a.baseHp !== b.baseHp ? (a.baseHp > b.baseHp ? 0 : 1) : a.stats.damage >= b.stats.damage ? 0 : 1;
    s.events.push({ k: 'win', winner: s.winner });
  }
}

/** Ends the game immediately in favour of `winner` (disconnect / forfeit). */
export function forfeit(s: GameState, winner: Side, reason: string): void {
  if (s.winner !== null) return;
  s.winner = winner;
  s.winReason = reason;
  s.events.push({ k: 'win', winner });
}

function incomePhase(s: GameState): void {
  const decay = s.tick > SUDDEN_DEATH_AFTER_SEC * TICK_RATE;
  for (const side of [0, 1] as Side[]) {
    const p = s.players[side];
    p.goldFrac += (PASSIVE_GOLD[p.age] * p.incomeMult * (1 + p.econ * MINE_INCOME) * catchup(s, side)) / TICK_RATE;
    if (p.goldFrac >= 1) {
      const whole = Math.floor(p.goldFrac);
      p.gold += whole;
      p.goldFrac -= whole;
    }
    if (p.specialCd > 0) p.specialCd--;
    if (decay) p.baseHp -= (p.baseMaxHp * SUDDEN_DEATH_DECAY) / TICK_RATE;
  }
}

function trainingPhase(s: GameState): void {
  for (const side of [0, 1] as Side[]) {
    const p = s.players[side];
    const item = p.queue[0];
    if (!item) continue;
    if (item.remaining > 0) item.remaining = Math.max(0, item.remaining - p.trainSpeed);
    if (item.remaining > 0) continue;
    const x = baseFront(side);
    // Wait inside the base while the exit is blocked by a friendly unit.
    if (s.units.some((u) => u.owner === side && u.hp > 0 && Math.abs(u.x - x) < SPAWN_CLEARANCE)) continue;
    p.queue.shift();
    p.stats.trained++;
    const def = UNITS[item.unit];
    s.units.push({ id: s.nextId++, owner: side, def: def.id, x, hp: def.hp * p.power, cd: 0, mode: 'walk', lastAtk: -999 });
    s.events.push({ k: 'spawn', owner: side, x, def: def.id });
  }
}

function unitPhase(s: GameState): void {
  const alive = s.units.filter((u) => u.hp > 0);
  const attacks: Attack[] = [];

  for (const u of alive) {
    const def = UNITS[u.def];
    const dir = dirOf(u.owner);
    const charging = u.mode === 'walk' && !def.proj;
    const slowF = u.slow ? (u.slowF ?? 1) : 1;
    if (u.slow && --u.slow <= 0) u.slow = u.slowF = undefined;
    if (u.cd > 0) u.cd -= 1 - SLOW_ATTACK_SHARE * (1 - slowF);
    if (def.heal) healPhase(s, u, alive);

    let nearestEnemy: Unit | null = null;
    let dE = Infinity;
    let dA = Infinity;
    let allyW = 0;
    for (const o of alive) {
      if (o === u) continue;
      const d = (o.x - u.x) * dir;
      if (o.owner !== u.owner) {
        const dd = Math.max(0, d);
        if (d > -30 && dd < dE) {
          dE = dd;
          nearestEnemy = o;
        }
      } else if (d > 0 || (d === 0 && o.id < u.id)) {
        if (d < dA) {
          dA = d;
          allyW = UNITS[o.def].width;
        }
      }
    }
    const dB = Math.max(0, (baseFront(enemyOf(u.owner)) - u.x) * dir);

    if (nearestEnemy && dE <= def.range) {
      u.mode = 'fight';
      if (u.cd <= 0) attacks.push({ u, targetId: nearestEnemy.id, charge: charging });
    } else if (dB <= def.range) {
      u.mode = 'fight';
      if (u.cd <= 0) attacks.push({ u, targetId: -1, charge: charging });
    } else {
      let move = (def.speed * slowF) / TICK_RATE;
      if (dA < Infinity) move = Math.min(move, dA - ((def.width + allyW) / 2) * SPACING);
      if (move > 0.05) {
        u.x += move * dir;
        u.mode = 'walk';
      } else {
        u.mode = 'wait';
      }
    }
  }

  // Resolve attacks after every unit has decided (so order does not matter).
  for (const { u, targetId, charge } of attacks) {
    const def = UNITS[u.def];
    const hit = roll(s, def.damage * s.players[u.owner].power * (charge ? CHARGE_BONUS : 1) * (1 + (OVERTIME_UNIT_DAMAGE_MAX - 1) * overtime(s)));
    const target = targetId >= 0 ? s.units.find((o) => o.id === targetId) : undefined;
    u.cd = sec(def.attackInterval);
    u.lastAtk = s.tick;
    if (def.proj) {
      const tx = target ? target.x : baseFront(enemyOf(u.owner));
      s.projectiles.push({
        id: s.nextId++, owner: u.owner, kind: def.proj.kind, x: u.x, sx: u.x, sy: UNIT_SY, tx,
        dist0: Math.max(1, Math.abs(tx - u.x)), targetId, speed: def.proj.speed, damage: hit.dmg, splash: def.proj.splash ?? 0, crit: hit.crit,
        bonus: def.bonus, baseMult: def.baseMult,
      });
      s.events.push({ k: 'shot', x: u.x, kind: def.proj.kind, owner: u.owner });
    } else {
      s.events.push({ k: 'melee', x: u.x, owner: u.owner });
      if (target) damageUnit(s, target, hit.dmg * bonusVs(def.bonus, target), u.owner, hit.crit);
      else if (targetId < 0) damageBase(s, enemyOf(u.owner), hit.dmg * (def.baseMult ?? 1), u.owner);
    }
  }
}

/** Support units: heal the most injured ally in range when the heal is off cooldown. */
function healPhase(s: GameState, u: Unit, alive: Unit[]): void {
  const heal = UNITS[u.def].heal!;
  if (u.healCd && u.healCd > 0) {
    u.healCd--;
    return;
  }
  const power = s.players[u.owner].power;
  let best: Unit | null = null;
  let missing = 0;
  for (const o of alive) {
    if (o === u || o.owner !== u.owner || Math.abs(o.x - u.x) > heal.range) continue;
    const m = UNITS[o.def].hp * power - o.hp;
    if (m > missing) {
      missing = m;
      best = o;
    }
  }
  if (!best) return;
  const amount = Math.min(missing, heal.amount * power);
  best.hp += amount;
  u.healCd = sec(heal.interval);
  u.lastHeal = s.tick;
  const p = s.players[u.owner];
  p.xp += amount * XP_PER_DAMAGE * p.xpMult * catchup(s, u.owner);
  s.events.push({ k: 'heal', id: best.id, x: best.x, amount: Math.round(amount), owner: u.owner });
}

function turretPhase(s: GameState): void {
  for (const side of [0, 1] as Side[]) {
    const p = s.players[side];
    const bx = baseFront(side);
    for (let slot = 0; slot < p.slotCount; slot++) {
      const t = p.turrets[slot];
      if (!t) continue;
      if (t.cd > 0) t.cd--;
      if (t.cd > 0) continue;
      const def = TURRETS[t.def];
      let target: Unit | null = null;
      let best = def.range;
      for (const o of s.units) {
        if (o.owner === side || o.hp <= 0) continue;
        const d = Math.abs(o.x - bx);
        if (d <= best) {
          best = d;
          target = o;
        }
      }
      if (!target) continue;
      t.cd = sec(def.fireInterval);
      t.lastAtk = s.tick;
      const veteran = 1 + TURRET_AGE_UPGRADE * Math.max(0, p.age - def.age);
      const hit = roll(s, def.damage * veteran * (1 - (1 - OVERTIME_TURRET_MIN) * overtime(s)));
      s.projectiles.push({
        id: s.nextId++, owner: side, kind: def.proj.kind, x: bx, sx: bx, sy: turretHeight(slot), tx: target.x,
        dist0: Math.max(1, Math.abs(target.x - bx)), targetId: target.id, speed: def.proj.speed, damage: hit.dmg, splash: def.proj.splash ?? 0, crit: hit.crit,
        bonus: def.bonus, slow: def.slow && { f: def.slow.factor, t: sec(def.slow.duration) },
      });
      s.events.push({ k: 'shot', x: bx, kind: def.proj.kind, owner: side });
    }
  }
}

function projectilePhase(s: GameState): void {
  const keep = [];
  for (const pr of s.projectiles) {
    const target = pr.targetId >= 0 ? s.units.find((o) => o.id === pr.targetId && o.hp > 0) : undefined;
    if (target) pr.tx = target.x;
    const dx = pr.tx - pr.x;
    const stepLen = pr.speed / TICK_RATE;
    if (Math.abs(dx) > stepLen) {
      pr.x += Math.sign(dx) * stepLen;
      keep.push(pr);
      continue;
    }
    pr.x = pr.tx;
    // Impact
    const hitUnit = (o: Unit) => {
      damageUnit(s, o, pr.damage * bonusVs(pr.bonus, o), pr.owner, pr.crit);
      if (pr.slow && o.hp > 0) {
        o.slow = Math.max(o.slow ?? 0, pr.slow.t);
        o.slowF = Math.min(o.slowF ?? 1, pr.slow.f);
      }
    };
    if (pr.splash > 0) {
      for (const o of s.units) {
        if (o.owner !== pr.owner && o.hp > 0 && Math.abs(o.x - pr.tx) <= pr.splash) hitUnit(o);
      }
      if (pr.slow) s.events.push({ k: 'slowed', x: pr.tx, owner: pr.owner, radius: pr.splash });
      if (pr.targetId === -1) damageBase(s, enemyOf(pr.owner), pr.damage * (pr.baseMult ?? 1), pr.owner);
    } else if (target) {
      hitUnit(target);
    } else if (pr.targetId === -1) {
      damageBase(s, enemyOf(pr.owner), pr.damage * (pr.baseMult ?? 1), pr.owner);
    }
  }
  s.projectiles = keep;
}

function specialPhase(s: GameState): void {
  const keep = [];
  for (const sp of s.specials) {
    const def = SPECIALS[sp.def];
    // Land the impacts that are due.
    for (const hit of sp.pending) {
      if (--hit.t > 0) continue;
      for (const o of s.units) {
        {
        const d = Math.abs(o.x - hit.x);
        if (o.owner === sp.owner || o.hp <= 0 || d > def.radius) continue;
        const falloff = 1 - SPECIAL_FALLOFF * (d / def.radius);
        damageUnit(s, o, def.damage * falloff * (1 + (nextRandom(s) * 2 - 1) * SPECIAL_VARIANCE), sp.owner, false);
      }
      }
    }
    sp.pending = sp.pending.filter((h) => h.t > 0);
    // Schedule the next impact.
    if (sp.left > 0 && --sp.next <= 0) {
      sp.next = sp.interval;
      sp.left--;
      const enemies = s.units.filter((o) => o.owner !== sp.owner && o.hp > 0);
      let x: number;
      if (enemies.length && nextRandom(s) < SPECIAL_ACCURACY) x = enemies[Math.floor(nextRandom(s) * enemies.length)].x + (nextRandom(s) * 2 - 1) * SPECIAL_SCATTER;
      else x = LANE_LENGTH * (0.15 + 0.7 * nextRandom(s)); // wild shot: lands anywhere on the lane
      x = Math.max(0, Math.min(LANE_LENGTH, x));
      sp.pending.push({ x, t: STRIKE_DELAY_TICKS });
      s.events.push({ k: 'strike', x, owner: sp.owner, def: sp.def, radius: def.radius, delay: STRIKE_DELAY_TICKS / TICK_RATE });
    }
    if (sp.left > 0 || sp.pending.length) keep.push(sp);
  }
  s.specials = keep;
}

function reapPhase(s: GameState): void {
  const alive: Unit[] = [];
  for (const u of s.units) {
    if (u.hp > 0) {
      alive.push(u);
      continue;
    }
    const def = UNITS[u.def];
    const k = u.killer ?? enemyOf(u.owner);
    const kp = s.players[k];
    const defending = (u.x < LANE_LENGTH / 2) === (k === 0);
    const cu = catchup(s, k);
    const gold = Math.round(def.gold * kp.goldMult * (defending ? DEFENDER_GOLD_MULT : 1) * cu);
    const xp = def.xp * (defending ? DEFENDER_XP_MULT : 1) * kp.xpMult * cu;
    kp.gold += gold;
    kp.xp += xp;
    kp.stats.goldEarned += gold;
    kp.stats.kills++;
    s.events.push({ k: 'death', id: u.id, x: u.x, owner: u.owner, def: u.def });
    s.events.push({ k: 'gold', x: u.x, owner: k, amount: gold, xp: Math.round(xp) });
  }
  s.units = alive;
}

function damageUnit(s: GameState, target: Unit, dmg: number, attacker: Side, crit = false): void {
  if (target.hp <= 0) return;
  target.hp -= dmg;
  const ap = s.players[attacker];
  ap.stats.damage += dmg;
  ap.xp += dmg * XP_PER_DAMAGE * ap.xpMult * catchup(s, attacker);
  s.events.push({ k: 'hit', id: target.id, x: target.x, dmg: Math.round(dmg), owner: target.owner, crit });
  if (target.hp <= 0) target.killer = attacker;
}

function damageBase(s: GameState, victim: Side, dmgRaw: number, attacker: Side): void {
  const vp = s.players[victim];
  const dmg = dmgRaw * (1 + (OVERTIME_BASE_DAMAGE_MAX - 1) * overtime(s));
  vp.baseHp -= dmg;
  if (!vp.lastStand && vp.baseHp > 0 && vp.baseHp < vp.baseMaxHp * LAST_STAND_HP) {
    vp.lastStand = true;
    vp.specialCd = 0;
    s.events.push({ k: 'laststand', owner: victim });
  }
  const ap = s.players[attacker];
  ap.stats.damage += dmg;
  ap.xp += dmg * XP_PER_DAMAGE * ap.xpMult * catchup(s, attacker);
  s.events.push({ k: 'base_hit', owner: victim, dmg: Math.round(dmg) });
}

export const ageOf = (s: GameState, side: Side) => AGES[s.players[side].age];
