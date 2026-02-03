const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// import.meta 관련 에러 해결을 위한 설정
config.resolver.unstable_enablePackageExports = false;

// ESM 모듈 대신 CJS 사용하도록 강제
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;
