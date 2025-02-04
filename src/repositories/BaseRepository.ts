import { Collection, ObjectId, Filter, Sort, WithId, OptionalUnlessRequiredId } from 'mongodb';
import { IBaseRepository, QueryOptions } from './IBaseRepository';


export interface BaseDocument {
  _id?: string | ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class BaseRepository<T extends BaseDocument> implements IBaseRepository<T> {
  constructor(protected collection: Collection<T>) { }

  protected getBaseQuery(): Filter<T> {
    return { isDeleted: false } as Filter<T>;
  }

  async findOne(query: Filter<T>): Promise<WithId<T> | null> {
    return this.collection.findOne({ ...this.getBaseQuery(), ...query });
  }

  async findMany(query: Filter<T>, options?: QueryOptions): Promise<WithId<T>[]> {
    let cursor = this.collection.find(query);
    if (options?.sort) cursor = cursor.sort(options.sort as Sort);
    if (options?.limit) cursor = cursor.limit(options.limit);
    if (options?.skip) cursor = cursor.skip(options.skip);
    if (options?.select) {
      const projection = options.select.reduce((acc, field) => ({ ...acc, [field]: 1 }), {});
      cursor = cursor.project(projection);
    }
    return cursor.toArray();
  }

  async create(data: Partial<T>): Promise<WithId<T>> {
    const result = await this.collection.insertOne({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as OptionalUnlessRequiredId<T>);

    return this.collection.findOne({ _id: result.insertedId as ObjectId } as Filter<T>) as Promise<WithId<T>>
  }

  async update(id: string, data: Partial<T>): Promise<WithId<T> | null> {
    const objectId = new ObjectId(id);
    const updated = await this.collection.findOneAndUpdate(
      { _id: objectId } as Filter<T>,
      {
        $set: {
          ...data,
          updatedAt: new Date()
        } as Partial<T>
      },
      { returnDocument: 'after' }
    );
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const objectId = new ObjectId(id);
    const result = await this.collection.updateOne(
      { _id: objectId } as Filter<T>,
      {
        $set: {
          isDeleted: true,
          updatedAt: new Date()
        } as unknown as Partial<T>
      }
    );
    return result.modifiedCount === 1;
  }

  async count(query: Filter<T>): Promise<number> {
    return this.collection.countDocuments(query);
  }

  async paginate(query: Filter<T>, page: number, limit: number): Promise<{
    items: WithId<T>[];
    total: number;
  }> {
    const [items, total] = await Promise.all([
      this.findMany(query, { skip: (page - 1) * limit, limit }),
      this.count(query)
    ]);
    return { items, total };
  }
}