import { defineConfig } from 'tsup';

// Dual ESM + CJS + .d.ts. Output:
//   dist/index.js   (ESM, package "type":"module")
//   dist/index.cjs  (CJS)
//   dist/index.d.ts (types)
// Consumed by open-design daemon (NodeNext ESM) and the aihubmix-video Next app.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  target: 'es2022',
  sourcemap: true,
  treeshake: true,
});
