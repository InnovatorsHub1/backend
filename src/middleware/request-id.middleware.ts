import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const requestId = (req: Request, _res: Response, next: NextFunction): void => {
 req.id = req.headers['x-request-id']?.toString() || uuidv4();
 next(); 
};