import { BaseDocument } from './base.types';

export interface User extends BaseDocument {
    googleId: string;
    email: string;
    name: string;
    picture?: string;
    lastLogin?: Date;
    isActive: boolean;
}