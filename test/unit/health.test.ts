import request from 'supertest';
import { App } from '../../src/app';
import { config } from '../../src/config';
import { container } from '../../src/core/di/container';
import { TYPES } from '../../src/core/di/types';

describe('Health Check API', () => {
  let app: App;
  const TEST_PORT = 3001;
  const API_KEY = 'your-api-key';

  beforeAll(async () => {
    config.port = TEST_PORT;
    // Changed from resolve to get
    app = container.get<App>(TYPES.App);
    await app.start();
  });

  afterAll(async () => {
    await app.stop();
    // Add container cleanup
    container.unbindAll();
  });

  describe('GET /health', () => {
    it('should handle valid request', async () => {
      const response = await request(app.getServer())
        .get(`${config.baseUrl}/health`)
        .query({ version: '1' })
        .set('x-api-key', API_KEY);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        version: expect.any(String)
      });
    });

    // Add error case test
    it('should handle request without api key', async () => {
      const response = await request(app.getServer())
        .get(`${config.baseUrl}/health`)
        .query({ version: '1' });

      expect(response.status).toBe(401);
    });
  });
});