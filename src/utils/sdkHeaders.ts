export const SDK_TYPE = 'Javascript';
export const SDK_VERSION = '__SDK_VERSION__';

export function getSDKHeaders(): Record<string, string> {
  return {
    'X-SDK-Type': SDK_TYPE,
    'X-SDK-Version': SDK_VERSION,
  };
}
