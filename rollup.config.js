import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';
import replace from '@rollup/plugin-replace';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

// Get base URL from environment or use default
const PLAYKIT_BASE_URL = process.env.PLAYKIT_BASE_URL || 'https://api.playkit.ai';

console.log('[Rollup] Building with PLAYKIT_BASE_URL:', PLAYKIT_BASE_URL);

const banner = `/**
 * ${packageJson.name} v${packageJson.version}
 * ${packageJson.description}
 * @license ${packageJson.license}
 */`;

export default [
  // ESM and CJS builds
  {
    input: 'src/index.ts',
    output: [
      {
        file: packageJson.module,
        format: 'esm',
        sourcemap: true,
        banner,
      },
      {
        file: packageJson.main,
        format: 'cjs',
        sourcemap: true,
        banner,
        exports: 'named',
      },
    ],
    plugins: [
      replace({
        preventAssignment: true,
        values: {
          '__PLAYKIT_BASE_URL__': JSON.stringify(PLAYKIT_BASE_URL),
        },
      }),
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false, // We'll handle declarations separately
      }),
    ],
    external: ['eventemitter3'],
  },

  // UMD build for browsers
  {
    input: 'src/index.ts',
    output: {
      file: packageJson.browser,
      format: 'umd',
      name: 'PlayKitSDK',
      sourcemap: true,
      banner,
      exports: 'named',
      globals: {
        eventemitter3: 'EventEmitter3',
      },
    },
    plugins: [
      replace({
        preventAssignment: true,
        values: {
          '__PLAYKIT_BASE_URL__': JSON.stringify(PLAYKIT_BASE_URL),
        },
      }),
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
    ],
    external: [],
  },

  // Type definitions
  {
    input: 'src/index.ts',
    output: {
      file: packageJson.types,
      format: 'esm',
    },
    plugins: [dts()],
  },
];
