import { randomBytes } from 'node:crypto';

export class RoomRegistry {
  #rooms = new Map();
  #memberships = new Map();

  create(host, title) {
    if (this.#memberships.has(host)) throw new Error('Connection is already in a room');
    let id;
    do {
      id = randomBytes(3).toString('hex');
    } while (this.#rooms.has(id));
    const room = { id, title, host, viewers: new Set() };
    this.#rooms.set(id, room);
    this.#memberships.set(host, { roomId: id, role: 'host' });
    return room;
  }

  get(id) {
    return this.#rooms.get(id) ?? null;
  }

  join(id, viewer) {
    if (this.#memberships.has(viewer)) throw new Error('Connection is already in a room');
    const room = this.get(id);
    if (!room) return null;
    room.viewers.add(viewer);
    this.#memberships.set(viewer, { roomId: id, role: 'viewer' });
    return room;
  }

  viewers(id) {
    return [...(this.get(id)?.viewers ?? [])];
  }

  membership(connection) {
    return this.#memberships.get(connection) ?? null;
  }

  leave(connection) {
    const member = this.membership(connection);
    if (!member) return null;
    const room = this.get(member.roomId);
    this.#memberships.delete(connection);
    if (member.role === 'host') {
      for (const viewer of room.viewers) this.#memberships.delete(viewer);
      this.#rooms.delete(room.id);
    } else {
      room.viewers.delete(connection);
    }
    return { ...member, room, viewers: [...room.viewers] };
  }
}
