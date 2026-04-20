import Constants from 'expo-constants';

/**
 * デモモードフラグ。`EXPO_PUBLIC_DEMO=true` で有効。
 * app.config.ts 経由で `extra.demoMode` に反映される。
 */
export const DEMO_MODE: boolean = !!Constants.expoConfig?.extra?.demoMode;

export * from './demoStore';
export * from './demoAuth';
