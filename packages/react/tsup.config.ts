import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  external: ['react', 'react-dom', 'framer-motion'],
  injectStyle: false, // We'll handle the CSS separately or as a dist file
  onSuccess: async () => {
    // Optional: copy styles to dist if needed, tsup usually handles this if imported
  }
});
