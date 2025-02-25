import { injectable } from 'inversify';

@injectable()
export class RoleService {
  // constructor() {}
  async createRole(): Promise<void> {
    console.log('RoleService.createRole');
  }
}
