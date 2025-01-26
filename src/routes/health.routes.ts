import { Router } from 'express';
import { HealthController } from '@gateway/controllers/health.controller';
import { createValidator } from '@gateway/middleware/validate-request.middleware';


export class HealthRoutes {
 public router: Router;
 private controller: HealthController;

 constructor() {
   this.router = Router();
   this.controller = new HealthController();
   this.setupRoutes();
 }

 private setupRoutes(): void {
   const healthCheckValidator = createValidator({
     headers: ['x-api-key'],
     query: ['version']
   });

   this.router.get(
     '/',
     healthCheckValidator,
     this.controller.check.bind(this.controller)
   );
 }
}