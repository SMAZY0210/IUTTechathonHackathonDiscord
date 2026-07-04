// Vercel serverless entry point. Vercel invokes this exported Express app as
// a per-request handler — there's no http.createServer/listen() here, and no
// background setInterval simulator, because serverless instances freeze
// between requests (a timer would never actually fire).
//
// Instead, `catchUp()` fast-forwards the store to "now" at the top of every
// request, replaying however many ticks elapsed since the last request this
// warm instance handled. See ../src/catchup.js for details and tradeoffs.

import express from 'express';
import cors from 'cors';

import { createStore } from '../src/store.js';
import { createApiRouter } from '../src/api.js';
import { createCatchup } from '../src/catchup.js';

// Created once per cold start, then reused for every request this warm
// instance handles afterwards — this is what gives the simulation continuity
// between requests (until the instance is recycled).
const store = createStore();
const catchUp = createCatchup(store);

const app = express();
app.use(cors());
app.use((req, res, next) => {
  catchUp();
  next();
});
app.use('/api', createApiRouter(store));

export default app;
