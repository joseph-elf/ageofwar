import Phaser from 'phaser';
import './style.css';
import type { Difficulty } from './data/config';
import { LocalController } from './game/localController';
import { BootScene } from './game/scenes/BootScene';
import { GameScene, type GameSceneData } from './game/scenes/GameScene';
import type { GameController } from './game/controller';
import { Menu, type LobbyHandle, type LobbyUi } from './ui/menu';
import { sfx } from './game/audio';
import { music } from './game/music';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#0b0d18',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH }, // fills any screen; the world adapts in GameScene.layout()
  input: { touch: { capture: true }, windowEvents: true },
  scene: [BootScene, GameScene],
});

const gameEl = document.getElementById('game')!;
let inMatch = false;
let current: GameController | null = null;
// Closing/reloading the tab = leaving: tells the opponent immediately instead of making them wait out the grace period.
window.addEventListener('pagehide', (e) => !e.persisted && current?.online && current.destroy());

// Keep a phone's screen awake during a match.
let wake: WakeLockSentinel | null = null;
const keepAwake = () => void navigator.wakeLock?.request('screen').then((w) => (wake = w), () => {});
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && inMatch && keepAwake());

function showMenu(screen: Parameters<Menu['show']>[0] = 'main'): void {
  if (inMatch) game.scene.stop('Game');
  inMatch = false;
  void wake?.release();
  wake = null;
  gameEl.classList.add('hidden');
  menu.show(screen);
}

function startMatch(controller: GameController, rematch?: () => void): void {
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__aow = { game, controller, sfx };
  menu.hide();
  gameEl.classList.remove('hidden');
  const data: GameSceneData = { controller, onExit: () => showMenu(controller.online ? 'multi' : 'main'), onRematch: rematch };
  if (inMatch) game.scene.stop('Game');
  inMatch = true;
  current = controller;
  keepAwake();
  game.scene.start('Game', data);
}

function startSingle(d: Difficulty): void {
  startMatch(new LocalController(d), () => startSingle(d));
}

const menu = new Menu(document.getElementById('menu-root')!, {
  single: startSingle,
  create: (ui) => createOnline(ui),
  join: (code, ui) => joinOnline(code, ui),
});

// Multiplayer is loaded lazily so single-player never pays for PeerJS.
function createOnline(ui: LobbyUi): LobbyHandle {
  let handle: LobbyHandle | undefined;
  let cancelled = false;
  void import('./net/session').then(({ hostGame }) => {
    if (cancelled) return;
    handle = hostGame(ui, (ctl) => startMatch(ctl));
  });
  return { cancel: () => ((cancelled = true), handle?.cancel()) };
}
function joinOnline(code: string, ui: LobbyUi): LobbyHandle {
  let handle: LobbyHandle | undefined;
  let cancelled = false;
  void import('./net/session').then(({ joinGame }) => {
    if (cancelled) return;
    handle = joinGame(code, ui, (ctl) => startMatch(ctl));
  });
  return { cancel: () => ((cancelled = true), handle?.cancel()) };
}

game.events.once('booted', () => {
  showMenu('main');
  // Soundtrack starts with the first click/tap (browser autoplay rules) and follows the local player's age.
  music.play(() => (inMatch && current ? current.state.players[current.me].age : 1));
});
gameEl.classList.add('hidden');
void sfx;
