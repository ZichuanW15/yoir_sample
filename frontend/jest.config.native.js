/* global __dirname */
const base = require('./jest.config');
const { resolveBabelOptions } = require('jest-expo/src/resolveBabelOptions');

/**
 * Component/logic evidence only: this does not build, launch, or test a device.
 * The platform presets select native module extensions and Babel's platform
 * caller, rather than relabelling the default preset or mutating Platform.OS.
 * Shared regressions run on BOTH platforms; known defects remain separate and
 * return a real nonzero exit status. Planned features are excluded throughout.
 */
module.exports = function nativeConfig(platform, { defects = false } = {}) {
  if (platform !== 'ios' && platform !== 'android') throw new Error(`Unsupported native QA platform: ${platform}`);
  const preset = require(`jest-expo/${platform}/jest-preset`);
  const babelOptions = resolveBabelOptions(__dirname);
  // jest-expo 57's platform presets replace the transform options with only a
  // caller. This app intentionally has no Babel file: preserve Expo's automatic
  // preset resolution as well as the platform caller, including RN Flow syntax.
  const transform = Object.fromEntries(Object.entries(preset.transform).map(([pattern, transformer]) => {
    if (!Array.isArray(transformer) || transformer[0] !== 'babel-jest') return [pattern, transformer];
    const options = transformer[1] || {};
    return [pattern, [transformer[0], {
      ...babelOptions,
      ...options,
      caller: { ...babelOptions.caller, ...options.caller },
    }]];
  }));
  return {
    ...base,
    preset: `jest-expo/${platform}`,
    transform,
    displayName: `${platform}${defects ? '-defects' : '-components'}`,
    globals: { __QA_NATIVE_PLATFORM__: platform },
    testMatch: defects
      ? ['<rootDir>/__tests__/defects/**/*.(spec|test).[jt]s?(x)']
      : base.testMatch,
    testPathIgnorePatterns: defects
      ? []
      : base.testPathIgnorePatterns.filter((pattern) => !pattern.includes('/__tests__/native/')),
    collectCoverage: false,
    coverageThreshold: undefined,
    coverageDirectory: `<rootDir>/coverage/${platform}${defects ? '-defects' : ''}`,
  };
};
