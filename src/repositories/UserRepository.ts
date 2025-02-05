import { Collection, Filter } from 'mongodb';
import { injectable } from 'inversify';

import { User } from '../types/user.types';

import { BaseRepository } from './BaseRepository';

@injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(collection: Collection<User>) {
    super(collection);
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.findOne({ googleId } as Filter<User>);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email } as Filter<User>);
  }

  async upsertGoogleUser(googleProfile: { googleId: string; email: string; name: string; picture?: string }): Promise<User> {
    const existingUser = await this.findByGoogleId(googleProfile.googleId);

    if (existingUser) {
      const updated = await this.update(existingUser._id!.toString(), {
        name: googleProfile.name,
        picture: googleProfile.picture,
        lastLogin: new Date()
      });

      return updated!;
    }

    return this.create({
      ...googleProfile,
      isActive: true,
      isDeleted: false,
      lastLogin: new Date()
    });
  }
}
