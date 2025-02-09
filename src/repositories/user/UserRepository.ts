import { injectable } from 'inversify';
import { BaseRepository } from '@gateway/repositories/BaseRepository';
import { IUser, ISSOUser, ICredentialsUser } from './IUser';
import { mongoConnection } from '@gateway/utils/mongoConnection';
import { Condition, ObjectId, Filter } from 'mongodb';
import { ApiError } from '@gateway/core/errors/api.error';
import { StatusCodes } from 'http-status-codes';

@injectable()
export class UserRepository extends BaseRepository<IUser> {
    constructor() {
        const collection = mongoConnection.getClient().db().collection<IUser>('users');
        super(collection);
        this.createIndexes();
    }


    private async createIndexes(): Promise<void> {
        await this.collection.createIndex(
            { lastActiveAt: 1 },
            { expireAfterSeconds: 60 * 60 * 24 * 30, background: true }
        );
    }

    private async runWithErrorHandling<T>(fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        } catch {
            throw new ApiError('Cannot connect to database', StatusCodes.INTERNAL_SERVER_ERROR, 'UserRepository');
        }
    }



    async findByEmail(email: string): Promise<ICredentialsUser | null> {
        return this.findOne({ email }) as Promise<ICredentialsUser> | null;
    }


    async findById(id: string): Promise<IUser | null> {
        return this.runWithErrorHandling(async () => {
            const objectId = new ObjectId(id);
            return await this.findOne({ _id: objectId });
        });
    }


    async findByProvider(provider: ISSOUser['provider'], providerId: string): Promise<IUser | null> {
        return this.runWithErrorHandling(async () => {
            return this.findOne({ provider, providerId });
        });
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
        });
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
        });
    }


    async updateLastLogin(userId: string): Promise<void> {
        return this.runWithErrorHandling(async () => {
            await this.collection.updateOne(
                { _id: new ObjectId(userId) } as Condition<IUser>,
                {

                    $set: {
                        lastLogin: new Date(),
                        lastActiveAt: new Date()
                    },
                    $currentDate: { updatedAt: true }
                }
            );
        });
    }


    async updateActivity(userId: string): Promise<void> {
        return this.runWithErrorHandling(async () => {
            await this.collection.updateOne(
                { _id: new ObjectId(userId) } as Condition<IUser>,
                {

                    $set: { lastActiveAt: new Date() },
                    $currentDate: { updatedAt: true }
                }
            );
        });
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
        });
    }

    async deleteMany(filter: Filter<IUser> = {}): Promise<void> {
        return this.runWithErrorHandling(async () => {
            await this.collection.deleteMany(filter);
        });
    }

} 