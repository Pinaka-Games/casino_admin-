"use client";

import {
  Flame,
  Sparkles,
  Star,
  Crown,
  Trophy,
  Gem,
  Zap,
  Dice5,
  CircleDot,
  Spade,
  Club,
  Diamond,
  Heart,
  LayoutGrid,
  Layers,
  Tv,
  Users,
  PlayCircle,
  Target,
  Clock,
  Coins,
  Gamepad2,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps a stored tab icon key → its lucide component.
 *
 * Keys MUST match the player app's `components/home/liveCasinoIcons.tsx`, which
 * is the same registry on the other side of the API. The DB only ever stores the
 * key, so the two lists are the contract.
 */
export const LIVE_CASINO_TAB_ICONS: Record<string, LucideIcon> = {
  flame: Flame,
  sparkles: Sparkles,
  star: Star,
  crown: Crown,
  trophy: Trophy,
  gem: Gem,
  zap: Zap,
  dice: Dice5,
  roulette: CircleDot,
  spade: Spade,
  club: Club,
  diamond: Diamond,
  heart: Heart,
  grid: LayoutGrid,
  layers: Layers,
  tv: Tv,
  users: Users,
  play: PlayCircle,
  target: Target,
  clock: Clock,
  coins: Coins,
  joystick: Gamepad2,
};

/**
 * The icon a tab with no (or an unknown) key falls back to.
 *
 * Exported as the component rather than behind a `resolve(key)` helper so call
 * sites read it out of the map by property access — a lookup the compiler (and
 * the react-hooks lint rule) can see is static, not a component minted per
 * render.
 */
export const DEFAULT_TAB_ICON: LucideIcon = Flame;
