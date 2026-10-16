import { EventEmitter } from "node:events";

/**
 * Decouples REST controllers from the Socket.IO hub without creating
 * circular imports: controllers emit, the hub subscribes.
 */
export const roomBus = new EventEmitter();
roomBus.setMaxListeners(100);
