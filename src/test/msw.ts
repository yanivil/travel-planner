import { setupServer } from 'msw/node';

// No network calls exist in M0 — the server is wired now (TESTING.md §6) so the
// first API integration (routing, M1) starts from a working mock layer.
export const server = setupServer();
