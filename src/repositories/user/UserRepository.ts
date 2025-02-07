import { injectable } from 'inversify';
import { BaseRepository } from '@gateway/repositories/BaseRepository';
import { IUser, ISSOUser, ICredentialsUser } from './IUser';
import { mongoConnection } from '@gateway/utils/mongoConnection';
import { Condition, ObjectId, Filter } from 'mongodb';

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

    async findByEmail(email: string): Promise<ICredentialsUser | null> {
        return this.findOne({ email }) as Promise<ICredentialsUser> | null;
    }

    async findById(id: string): Promise<IUser | null> {
        return this.findOne({ _id: new ObjectId(id) } as any);
    }

    async findByProvider(provider: ISSOUser['provider'], providerId: string): Promise<IUser | null> {
        return this.findOne({ provider, providerId });
    }

    async incrementFailedAttempts(userId: string): Promise<void> {
        await this.collection.updateOne(
            { _id: new ObjectId(userId) } as Condition<IUser>,
            {
                $inc: { failedLoginAttempts: 1 },
                $currentDate: { updatedAt: true }
            }
        );
    }

    async resetFailedAttempts(userId: string): Promise<void> {
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
    }

    async updateLastLogin(userId: string): Promise<void> {
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
    }

    async updateActivity(userId: string): Promise<void> {
        await this.collection.updateOne(
            { _id: new ObjectId(userId) } as Condition<IUser>,
            {
                $set: { lastActiveAt: new Date() },
                $currentDate: { updatedAt: true }
            }
        );
    }

    async getInactivityTime(userId: string): Promise<number> {
        const pipeline = [
            { $match: { _id: new ObjectId(userId) } },
            {
                $project: {
                    inactiveMinutes: {
                        $divide: [
                            { $subtract: [new Date(), '$lastActiveAt'] },
                            1000 * 60  // המרה למיליסקונדות לדקות
                        ]
                    }
                }
            }
        ];

        const result = await this.collection.aggregate(pipeline).toArray();
        return result[0]?.inactiveMinutes || 0;
    }

    async getUsersWithInactivityTime(): Promise<Array<{ userId: string, inactiveMinutes: number }>> {
        console.time('mongo-aggregation');
        const pipeline = [
            {
                $project: {
                    userId: '$_id',
                    inactiveMinutes: {
                        $divide: [
                            { $subtract: [new Date(), '$lastActiveAt'] },
                            1000 * 60
                        ]
                    }
                }
            }
        ];
        const result = await this.collection.aggregate<{ userId: string; inactiveMinutes: number }>(pipeline).toArray();
        console.timeEnd('mongo-aggregation');
        return result;
    }

    async getUsersWithInactivityTimeJS(): Promise<Array<{ userId: string, inactiveMinutes: number }>> {
        console.time('js-calculation');
        const users = await this.collection.find({}, { projection: { _id: 1, lastActiveAt: 1 } }).toArray();
        const result = users.map(user => ({
            userId: user._id.toString(),
            inactiveMinutes: (new Date().getTime() - user.lastActiveAt.getTime()) / (1000 * 60)
        }));
        console.timeEnd('js-calculation');
        return result;
    }

    async deleteMany(filter: Filter<IUser> = {}): Promise<void> {
        await this.collection.deleteMany(filter);
    }
} 