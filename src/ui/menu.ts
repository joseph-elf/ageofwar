import type { Roster } from '../data/ages';
import { DIFFICULTY, type Difficulty } from '../data/config';
import { saveSettings, settings } from '../game/settings';
import { sfx } from '../game/audio';

export interface LobbyUi {
  status(msg: string, kind?: 'info' | 'ok' | 'error'): void;
  code(c: string): void;
}
export interface LobbyHandle {
  cancel(): void;
}
export interface MenuHandlers {
  single(d: Difficulty): void;
  create(ui: LobbyUi): LobbyHandle;
  join(code: string, ui: LobbyUi): LobbyHandle;
}

type Screen = 'main' | 'single' | 'multi' | 'host' | 'join' | 'howto' | 'settings';

/** DOM menus. Plain HTML keeps text, forms and layout simple; Phaser only renders the match. */
export class Menu {
  private lobby?: LobbyHandle;
  constructor(private root: HTMLElement, private h: MenuHandlers) {}

  show(screen: Screen = 'main'): void {
    this.lobby?.cancel();
    this.lobby = undefined;
    this.root.classList.remove('hidden');
    const view = { main: () => this.main(), single: () => this.single(), multi: () => this.multi(), host: () => this.host(), join: () => this.join(), howto: () => this.howto(), settings: () => this.settings() }[screen];
    view();
    this.root.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => sfx.play('click')));
  }
  hide(): void {
    this.lobby?.cancel();
    this.lobby = undefined;
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
  }

  private render(html: string, wide = false): void {
    this.root.innerHTML = `<div class="menu-bg"><div class="menu-card${wide ? ' wide' : ''}">${html}</div><div class="credit">Ages of War II — an original game · v1.0</div></div>`;
  }
  private on(sel: string, f: () => void): void {
    (this.root.querySelector(sel) as HTMLElement).onclick = f;
  }

  private main(): void {
    this.render(`<h1 class="logo">AGES<br><span>OF WAR II</span></h1><p class="sub">Evolve. Defend. Conquer.</p>
      <button id="sp" class="primary big">Single Player</button><button id="mp" class="big">Multiplayer</button>
      <button id="how">How to Play</button><button id="set">Settings</button>`);
    this.on('#sp', () => this.show('single'));
    this.on('#mp', () => this.show('multi'));
    this.on('#how', () => this.show('howto'));
    this.on('#set', () => this.show('settings'));
  }

  private single(): void {
    const descs: Record<Difficulty, string> = { easy: 'Slow to react, light army. Great for learning.', normal: 'A fair fight. Uses turrets and specials.', hard: 'Fast, greedy and well-supplied. Good luck.' };
    this.render(`<h2>Choose difficulty</h2>${this.rosterPicker()}${(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => `<button class="diff ${d}" data-d="${d}"><b>${DIFFICULTY[d].label}</b><small>${descs[d]}</small></button>`).join('')}<button id="back">Back</button>`);
    this.bindRoster();
    this.root.querySelectorAll<HTMLElement>('.diff').forEach((b) => (b.onclick = () => this.h.single(b.dataset.d as Difficulty)));
    this.on('#back', () => this.show('main'));
  }

  /** Classic / Extended unit roster toggle (remembered in settings, read when the match is created). */
  private rosterPicker(): string {
    const opt = (r: Roster, label: string, desc: string) => `<button class="roster-opt${settings.roster === r ? ' on' : ''}" data-roster="${r}"><b>${label}</b><small>${desc}</small></button>`;
    return `<div class="roster"><span class="roster-lbl">Units</span>${opt('classic', 'Classic', 'The original units and turrets')}${opt('extended', 'Extended', 'Adds healers, siege, anti-armour units and slowing turrets')}</div>`;
  }
  private bindRoster(): void {
    this.root.querySelectorAll<HTMLElement>('.roster-opt').forEach((b) => {
      b.onclick = () => {
        settings.roster = b.dataset.roster as Roster;
        saveSettings();
        this.root.querySelectorAll('.roster-opt').forEach((o) => o.classList.toggle('on', o === b));
      };
    });
  }

  private multi(): void {
    this.render(`<h2>Multiplayer</h2><p class="sub">Peer-to-peer 1v1. One player creates a game and shares the 6-character code.</p>
      ${this.rosterPicker()}<p class="sub small">The units choice applies to games you create; when joining, the host's choice is used.</p>
      <button id="create" class="primary big">Create game</button><button id="join" class="big">Join game</button><button id="back">Back</button>`);
    this.bindRoster();
    this.on('#create', () => this.show('host'));
    this.on('#join', () => this.show('join'));
    this.on('#back', () => this.show('main'));
  }

  private lobbyUi(): LobbyUi {
    const st = this.root.querySelector('#status') as HTMLElement;
    const code = this.root.querySelector('#code') as HTMLElement | null;
    return {
      status: (m, kind = 'info') => {
        st.textContent = m;
        st.className = `status ${kind}`;
      },
      code: (c) => {
        if (code) code.textContent = c;
      },
    };
  }

  private host(): void {
    this.render(`<h2>Create game</h2><p class="sub">Share this code with your opponent:</p><div id="code" class="code">······</div>
      <button id="copy">Copy code</button><div id="status" class="status info">Connecting to the signaling server…</div><button id="back">Cancel</button>`);
    this.on('#back', () => this.show('multi'));
    this.on('#copy', () => void navigator.clipboard?.writeText((this.root.querySelector('#code') as HTMLElement).textContent ?? ''));
    this.lobby = this.h.create(this.lobbyUi());
  }

  private join(): void {
    this.render(`<h2>Join game</h2><p class="sub">Enter the 6-character room code:</p>
      <input id="codein" class="codein" maxlength="6" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" inputmode="text" enterkeyhint="go" placeholder="ABC123"><button id="go" class="primary big">Connect</button>
      <div id="status" class="status info"></div><button id="back">Back</button>`);
    const input = this.root.querySelector('#codein') as HTMLInputElement;
    input.focus();
    input.oninput = () => (input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    const go = () => {
      if (input.value.length !== 6) return this.lobbyUi().status('Codes are 6 characters long.', 'error');
      this.lobby?.cancel();
      (this.root.querySelector('#go') as HTMLButtonElement).disabled = true;
      this.lobby = this.h.join(input.value, this.lobbyUi());
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') go(); // (never return false from a key handler: that cancels the keystroke)
    });
    this.on('#go', go);
    this.on('#back', () => this.show('multi'));
  }

  private howto(): void {
    this.render(
      `<h2>How to play</h2><div class="howto">
      <p><b>Goal:</b> destroy the enemy base (right) before they destroy yours (left).</p>
      <p><b>Gold</b> trickles in over time and comes from killing enemy units. Spend it on <b>units</b> (they march automatically), <b>turrets</b> on your base, and extra <b>turret slots</b>.</p>
      <p><b>XP</b> comes from kills and damage. Spend it to <b>Evolve</b> into a new age: stronger units, turrets, base and special. Units already on the field stay.</p>
      <p><b>Special:</b> a long-cooldown attack that hits enemy units on the field (never the base). Best used on clumped enemies.</p>
      <p>Melee units queue up behind each other. Ranged units can shoot over allies. Fight near your own turrets and you earn bonus XP.</p>
      <p><b>Counters:</b> pikemen beat cavalry, armour-piercing turrets and the Ion Disruptor shred heavies and the Colossus, rams smash bases. A <b>Gold Mine</b> (G) raises your income. Turrets get stronger every time you evolve. From 10:00 both bases crumble (sudden death).</p>
      <table class="keys">
        <tr><td><kbd>1</kbd>–<kbd>5</kbd></td><td>Train unit</td><td><kbd>Q</kbd> <kbd>W</kbd> <kbd>E</kbd> <kbd>R</kbd></td><td>Build turret</td></tr>
        <tr><td><kbd>B</kbd></td><td>Buy turret slot</td><td><kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>4</kbd></td><td>Sell turret in slot</td></tr>
        <tr><td><kbd>G</kbd></td><td>Upgrade Gold Mine</td><td><kbd>S</kbd></td><td>Special ability</td></tr>
        <tr><td><kbd>V</kbd></td><td>Evolve</td><td></td><td></td></tr>
        <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>Scroll (also mouse at edge, drag, minimap)</td><td><kbd>P</kbd> / <kbd>Esc</kbd></td><td>Pause / menu</td></tr>
        <tr><td><kbd>M</kbd></td><td>Mute</td><td><kbd>F3</kbd></td><td>Debug overlay</td></tr>
      </table></div><button id="back" class="primary">Back</button>`,
      true,
    );
    this.on('#back', () => this.show('main'));
  }

  private settings(): void {
    const s = settings;
    this.render(
      `<h2>Settings</h2><div class="form">
      <label>Sound effects <input id="vol" type="range" min="0" max="100" value="${Math.round(s.volume * 100)}"></label>
      <label>Music <input id="mus" type="range" min="0" max="100" value="${Math.round(s.musicVolume * 100)}"></label>
      <label class="chk"><input id="mute" type="checkbox" ${s.muted ? 'checked' : ''}> Mute all sound</label>
      <label class="chk"><input id="fps" type="checkbox" ${s.showFps ? 'checked' : ''}> Show FPS</label>
      <h3>Multiplayer signaling server</h3><p class="sub small">Leave host empty to use PeerJS' free public server. Self-host with <code>peerjs --port 9000</code>.</p>
      <label>Host <input id="ph" type="text" value="${s.peerHost}" placeholder="(default: 0.peerjs.com)"></label>
      <label>Port <input id="pp" type="number" value="${s.peerPort}"></label>
      <label>Path <input id="pa" type="text" value="${s.peerPath}"></label>
      <label class="chk"><input id="ps" type="checkbox" ${s.peerSecure ? 'checked' : ''}> Secure (https / wss)</label>
      <h3>TURN relay (mobile data / strict networks)</h3><p class="sub small">Optional. Without it, players who can't connect directly are routed through a public relay automatically. To use your own TURN server, e.g. <code>turn:example.com:3478, turns:example.com:443?transport=tcp</code>.</p>
      <label>URLs <input id="tu" type="text" value="${s.turnUrls}" placeholder="turn:host:3478"></label>
      <label>User <input id="tn" type="text" value="${s.turnUser}" autocomplete="off"></label>
      <label>Password <input id="tp" type="text" value="${s.turnPass}" autocomplete="off"></label></div>
      <button id="back" class="primary">Done</button>`,
      true,
    );
    const q = <T extends HTMLInputElement>(id: string) => this.root.querySelector(id) as T;
    const apply = () => {
      s.volume = Number(q('#vol').value) / 100;
      s.musicVolume = Number(q('#mus').value) / 100;
      s.muted = q('#mute').checked;
      s.showFps = q('#fps').checked;
      s.peerHost = q('#ph').value.trim();
      s.peerPort = Number(q('#pp').value) || 443;
      s.peerPath = q('#pa').value.trim() || '/';
      s.peerSecure = q('#ps').checked;
      s.turnUrls = q('#tu').value.trim();
      s.turnUser = q('#tn').value.trim();
      s.turnPass = q('#tp').value.trim();
      saveSettings();
    };
    this.root.querySelectorAll('input').forEach((i) => (i.oninput = i.onchange = apply));
    this.on('#back', () => (apply(), this.show('main')));
  }
}
