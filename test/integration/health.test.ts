import request from 'supertest';
import { App } from '../../src/app';
import { config } from '../../src/config';

describe('Health Check API', () => {
 let app: App;
 const TEST_PORT = 3001;
 const API_KEY = 'your-api-key';

 beforeAll(async () => {
   config.port = TEST_PORT;
   app = new App();
   await app.start();
 });

 afterAll(async () => {
   await app.stop();
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
 });
});