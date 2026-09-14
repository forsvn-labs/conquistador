import type { ConquistadorConfig } from "./contracts.ts";
export declare function validateConfig(value: unknown): asserts value is ConquistadorConfig;
export declare function parseConfigYaml(text: string): ConquistadorConfig;
