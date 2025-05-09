import path from 'path';
import Sumi from '../src/lib/sumi';
import { defineConfig } from '../src/lib/sumi';

const PORT = 3001;

const exampleConfig = defineConfig({
  logger: true,
  routesDir: path.resolve(__dirname, 'routes'),
  middlewareDir: path.resolve(__dirname, 'middleware'),
  port: PORT,
  basePath: '/api/v1',
});

// Instantiate Sumi
const sumi = new Sumi(exampleConfig);

// METHOD 1: Let Sumi manage the server (preferred for development with hot reload)
sumi.burn(PORT);

// METHOD 2: Let Bun manage the server - DON'T USE BOTH METHODS!
// If you want Bun to manage the server instead, comment out the sumi.burn() call above
// and uncomment the export default below
/*
export default {
  port: PORT,
  fetch: sumi.fetch(),
};
*/
