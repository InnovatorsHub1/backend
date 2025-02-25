import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/di/types';
import { RoleService } from '@gateway/services/role/role.service';


@injectable()
export class RoleController {  

  constructor(
    @inject(TYPES.RoleService) private readonly service: RoleService,
  ) {
  }

}