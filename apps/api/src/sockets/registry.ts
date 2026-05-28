import type { Server as IOServer } from "socket.io";

/**
 * Tiny registry para acceder al objeto Socket.IO desde rutas Express
 * (que normalmente no lo tienen). Se setea desde http.ts después de
 * crear el server.
 */
class IoRef {
  private io: IOServer | null = null;
  set(io: IOServer): void {
    this.io = io;
  }
  get(): IOServer | null {
    return this.io;
  }
}

export const ioRef = new IoRef();
