import type { GameController } from '../game/controller';
import type { LobbyHandle, LobbyUi } from '../ui/menu';
import { GuestController } from './guestController';
import { GuestSession } from './guest';
import { HostSession } from './host';
import { HostController } from './hostController';
import { createRoom, joinRoom } from './lobby';

/** Create-game flow: open a room, wait for a guest, then hand a HostController to the shell. */
export function hostGame(ui: LobbyUi, start: (c: GameController) => void): LobbyHandle {
  ui.status('Connecting to the signaling server…');
  let started = false;
  const session = new HostSession(Date.now() >>> 0, {
    onJoin: () => {
      started = true;
      ui.status('Opponent connected!', 'ok');
      start(new HostController(session, () => room.close()));
    },
    onReject: (reason) => ui.status(reason, 'error'),
  });
  const room = createRoom({
    onCode: (code) => {
      ui.code(code);
      ui.status('Waiting for an opponent to join…');
    },
    onError: (msg) => ui.status(msg, 'error'),
    onConnection: (t) => session.attach(t),
  });
  return { cancel: () => !started && room.close() };
}

/** Join-game flow: connect, handshake (incl. version check), then hand a GuestController to the shell. */
export function joinGame(code: string, ui: LobbyUi, start: (c: GameController) => void): LobbyHandle {
  ui.status('Connecting…');
  let started = false;
  let ctl: GuestController | undefined;
  const room = joinRoom(code, {
    onError: (msg) => (started && ctl ? ctl.connectionLost() : ui.status(msg, 'error')),
    onOpen: (t) => {
      ui.status('Connected — checking game version…');
      const session = new GuestSession(t, {
        onWelcome: () => {
          started = true;
          ctl = new GuestController(session, () => room.reconnect(), () => room.close());
          ui.status('Joined!', 'ok');
          start(ctl);
        },
        onReject: (reason) => {
          ui.status(reason, 'error');
          room.close();
        },
        onDisconnect: () => (ctl ? ctl.connectionLost() : ui.status('Connection closed by the host.', 'error')),
      });
    },
  });
  return { cancel: () => !started && room.close() };
}
