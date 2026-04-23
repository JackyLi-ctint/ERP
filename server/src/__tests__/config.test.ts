import type { Config } from '../config';

describe('Config Module', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('bcryptRounds', () => {
    test('config reads BCRYPT_ROUNDS from env when set', () => {
      process.env.BCRYPT_ROUNDS = '10';
      const config = require('../config').default as Config;
      expect(config.bcryptRounds).toBe(10);
    });

    test('config falls back to default 12 when BCRYPT_ROUNDS is not set', () => {
      delete process.env.BCRYPT_ROUNDS;
      const config = require('../config').default as Config;
      expect(config.bcryptRounds).toBe(12);
    });
  });

  describe('corsOrigins', () => {
    test('config.corsOrigins splits CORS_ORIGIN on commas', () => {
      process.env.CORS_ORIGIN = 'http://a.com,http://b.com';
      const config = require('../config').default as Config;
      expect(config.corsOrigins).toEqual(['http://a.com', 'http://b.com']);
    });

    test('config.corsOrigins defaults to localhost when CORS_ORIGIN not set', () => {
      delete process.env.CORS_ORIGIN;
      const config = require('../config').default as Config;
      expect(config.corsOrigins).toEqual(['http://localhost:5173']);
    });
  });

  describe('uploadMaxBytes', () => {
    test('config.uploadMaxBytes defaults to 1048576 when env var not set', () => {
      delete process.env.UPLOAD_MAX_BYTES;
      const config = require('../config').default as Config;
      expect(config.uploadMaxBytes).toBe(1048576);
    });
  });

  describe('pagination', () => {
    test('config.pagination.maxSize defaults to 100', () => {
      delete process.env.PAGINATION_MAX_SIZE;
      const config = require('../config').default as Config;
      expect(config.pagination.maxSize).toBe(100);
    });

    test('config.pagination.defaultSize defaults to 20', () => {
      delete process.env.PAGINATION_DEFAULT_SIZE;
      const config = require('../config').default as Config;
      expect(config.pagination.defaultSize).toBe(20);
    });
  });

  describe('rateLimitAuth', () => {
    test('config.rateLimitAuth defaults to max=10 and windowMs=900000', () => {
      delete process.env.RATE_LIMIT_AUTH_MAX;
      delete process.env.RATE_LIMIT_AUTH_WINDOW_MS;
      const config = require('../config').default as Config;
      expect(config.rateLimitAuth.max).toBe(10);
      expect(config.rateLimitAuth.windowMs).toBe(900000);
    });
  });

  describe('rateLimitApi', () => {
    test('config.rateLimitApi defaults to max=200 and windowMs=60000', () => {
      delete process.env.RATE_LIMIT_API_MAX;
      delete process.env.RATE_LIMIT_API_WINDOW_MS;
      const config = require('../config').default as Config;
      expect(config.rateLimitApi.max).toBe(200);
      expect(config.rateLimitApi.windowMs).toBe(60000);
    });
  });

  describe('bodyLimit', () => {
    test('config.bodyLimit defaults to "10mb"', () => {
      delete process.env.BODY_LIMIT;
      const config = require('../config').default as Config;
      expect(config.bodyLimit).toBe('10mb');
    });
  });

  describe('azureStateTtlMs', () => {
    test('config.azureStateTtlMs defaults to 600000', () => {
      delete process.env.AZURE_STATE_TTL_MS;
      const config = require('../config').default as Config;
      expect(config.azureStateTtlMs).toBe(600000);
    });
  });

  describe('integer parsing', () => {
    test('config reads integer env vars correctly', () => {
      process.env.BCRYPT_ROUNDS = '15';
      process.env.UPLOAD_MAX_BYTES = '2097152';
      process.env.RATE_LIMIT_AUTH_MAX = '5';
      process.env.RATE_LIMIT_API_MAX = '300';
      const config = require('../config').default as Config;
      expect(config.bcryptRounds).toBe(15);
      expect(config.uploadMaxBytes).toBe(2097152);
      expect(config.rateLimitAuth.max).toBe(5);
      expect(config.rateLimitApi.max).toBe(300);
    });
  });
});
