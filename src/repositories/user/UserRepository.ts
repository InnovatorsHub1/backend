import { injectable } from 'inversify';
import { BaseRepository } from '@gateway/repositories/BaseRepository';
import { IUser, ISSOUser, ICredentialsUser } from './IUser';
import { getMongoConnection } from '@gateway/utils/mongoConnection';
import { Condition, ObjectId, Filter } from 'mongodb';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';
import { Request } from 'express';
import { CollectionName } from '@gateway/constants/db';


@injectable()
export class UserRepository extends BaseRepository<IUser> {
    constructor() {
        try {
            getMongoConnection().connect();
        } catch (error) {
            throw new ApiError('Failed to connect to database', StatusCodes.INTERNAL_SERVER_ERROR, 'UserRepository');
        }
        const collection = getMongoConnection().getClient().db().collection<IUser>(CollectionName.USERS);
        super(collection);
        this.createIndexes();
    }


    private async createIndexes(): Promise<void> {
        await this.collection.createIndex(
            { lastActiveAt: 1 },
            { expireAfterSeconds: 60 * 60 * 24 * 30, background: true }
        );
    }

    private async runWithErrorHandling<T>(fn: () => Promise<T>, errorMessage: string): Promise<T> {
        try {
            return await fn();
        } catch {
            throw new ApiError(errorMessage, StatusCodes.INTERNAL_SERVER_ERROR, 'UserRepository');
        }
    }



    async findByEmail(email: string): Promise<ICredentialsUser | null> {
        const user = await this.collection.findOne({ email: email.toLowerCase() }) as ICredentialsUser | null;
        return user;
    }


    async findById(id: string): Promise<IUser | null> {
        return this.runWithErrorHandling(async () => {
            const user = await this.findOne({ _id: new ObjectId(id) });
            return user || null;
        }, 'Cannot connect to database');
    }


    async findByProvider(provider: ISSOUser['provider'], providerId: string): Promise<IUser | null> {
        return this.runWithErrorHandling(async () => {
            return await this.findOne({ provider, providerId });
        }, 'Cannot connect to database');
    }


    async incrementFailedAttempts(userId: string): Promise<void> {
        return this.runWithErrorHandling(async () => {
            await this.collection.updateOne(
                { _id: new ObjectId(userId) } as Condition<IUser>,
                {
                    $inc: { failedLoginAttempts: 1 },
                    $currentDate: { updatedAt: true }
                }
            );
        }, 'Cannot connect to database');
    }


    async resetFailedAttempts(userId: string): Promise<void> {
        return this.runWithErrorHandling(async () => {
            await this.collection.updateOne(
                { _id: new ObjectId(userId) } as Condition<IUser>,
                {
                    $set: {

                        failedLoginAttempts: 0,
                        lockUntil: undefined
                    },
                    $currentDate: { updatedAt: true }
                }
            );
        }, 'Cannot connect to database');
    }


    async updateLastLogin(userId: string, deviceInfo?: Request['deviceInfo']): Promise<void> {
        return this.runWithErrorHandling(async () => {
            const updateData: any = {
                lastLogin: new Date(),
                lastActiveAt: new Date(),
                updatedAt: new Date()
            };
            if (deviceInfo) {
                updateData.deviceInfo = deviceInfo;
            }
            const result = await this.collection.updateOne(
                { _id: new ObjectId(userId) } as Condition<IUser>,
                {

                    $set: updateData
                }
            );
            if (result.modifiedCount === 0) {
                throw new ApiError('Failed to update user activity', StatusCodes.INTERNAL_SERVER_ERROR, 'UserRepository');
            }
        }, 'Cannot connect to database');
    }


    async updateActivity(userId: string, deviceInfo?: Request['deviceInfo']): Promise<void> {
        return this.runWithErrorHandling(async () => {
            const updateData: any = {
                lastActiveAt: new Date(),
                updatedAt: new Date()
            };
            if (deviceInfo) {
                updateData.deviceInfo = deviceInfo;
            }
            const result = await this.collection.updateOne(
                { _id: new ObjectId(userId) } as Condition<IUser>,
                { $set: updateData }
            );
            if (result.modifiedCount === 0) {
                throw new ApiError('Failed to update user activity', StatusCodes.INTERNAL_SERVER_ERROR, 'UserRepository');
            }
        }, 'Failed to update user activity');
    }


    async getInactivityTime(userId: string): Promise<number> {
        return this.runWithErrorHandling(async () => {
            const pipeline = [
                { $match: { _id: new ObjectId(userId) } },
                {

                    $project: {
                        inactiveMinutes: {
                            $divide: [
                                { $subtract: [new Date(), '$lastActiveAt'] },
                                1000 * 60
                            ]
                        }
                    }
                }
            ];

            const result = await this.collection.aggregate(pipeline).toArray();
            return result[0]?.inactiveMinutes || 0;
        }, 'Cannot connect to database');
    }

    async deleteMany(filter: Filter<IUser> = {}): Promise<void> {
        return this.runWithErrorHandling(async () => {
            await this.collection.deleteMany(filter);
        }, 'Cannot connect to database');
    }
} 