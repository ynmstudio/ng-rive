import { InjectionToken } from '@angular/core';

/**
 * Folder with Rive files relative to the application.
 */
export const RIVE_FOLDER = new InjectionToken<string>('Folder with Rive files');

/**
 * Version used to load the Rive WASM from CDN.
 */
export const RIVE_VERSION = new InjectionToken<string>('Version used to load Rive WASM');

/**
 * Local path to the Rive WASM file. Overrides version if provided.
 */
export const RIVE_WASM = new InjectionToken<string>('Local path to Rive WASM');
