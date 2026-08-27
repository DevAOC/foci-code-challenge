import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server.js";

// jsdom has no PointerEvent; Base UI's checkbox and dialog dispatch them.
if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  globalThis.PointerEvent = PointerEvent as unknown as typeof globalThis.PointerEvent;
}

// Every request the app makes must be answered by a handler the test declared.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
