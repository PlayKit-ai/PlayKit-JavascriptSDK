/**
 * UMD bundle entry.
 *
 * Goal: make `window.PlayKitSDK` directly the constructor class while still
 * exposing every named export as a property on it.
 *
 * Result:
 *   new window.PlayKitSDK(cfg)              // recommended
 *   new window.PlayKitSDK.PlayKitSDK(cfg)   // legacy v1.x form, still works
 *   window.PlayKitSDK.ChatClient            // named exports preserved
 */

import { PlayKitSDK } from './core/PlayKitSDK';
import * as namespace from './index';

Object.assign(PlayKitSDK, namespace);
(PlayKitSDK as any).PlayKitSDK = PlayKitSDK;
(PlayKitSDK as any).default = PlayKitSDK;

export default PlayKitSDK;
