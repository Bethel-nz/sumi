import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Hono } from 'hono';
import { hibana } from '../src/hibana/hibana';
import path from 'path';
import fs from 'fs';

describe('hibana', () => {
  const testRoot = path.resolve(process.cwd(), 'test-static');
  const testFile = path.join(testRoot, 'hello.txt');
  
  beforeAll(() => {
    if (!fs.existsSync(testRoot)) {
      fs.mkdirSync(testRoot, { recursive: true });
    }
    fs.writeFileSync(testFile, 'hello world');
  });

  afterAll(() => {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
    if (fs.existsSync(testRoot)) {
      fs.rmdirSync(testRoot);
    }
  });

  it('serves a static file by defaulting root to urlPath', async () => {
    const app = new Hono();
    // Default root should be ./test-static based on /test-static/*
    hibana(app, [{
      path: '/test-static/*'
    }]);

    const res = await app.request('/test-static/hello.txt');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('hello world');
  });

  it('serves a static file with explicit root mapping (mounting)', async () => {
     const app = new Hono();
     // Mount /static/ to ./test-static/
     hibana(app, [{
       path: '/static/*',
       root: 'test-static'
     }]);

     const res = await app.request('/static/hello.txt');
     expect(res.status).toBe(200);
     expect(await res.text()).toBe('hello world');
  });

  it('returns 404 for non-existent files', async () => {
    const app = new Hono();
    hibana(app, [{
      path: '/static/*',
      root: 'test-static'
    }]);

    const res = await app.request('/static/nope.txt');
    expect(res.status).toBe(404);
  });
});
