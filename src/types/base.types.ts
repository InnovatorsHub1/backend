import { ObjectId } from 'mongodb';

export interface BaseDocument {
    _id?: string | ObjectId;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}