import { setupServer } from "msw/node";

/** The fake API. Tests add handlers per case with `server.use(...)`. */
export const server = setupServer();
