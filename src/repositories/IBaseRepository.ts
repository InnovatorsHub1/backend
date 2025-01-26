import { Filter, Sort, WithId } from 'mongodb';

export interface IBaseRepository<T> {
  findOne(query: Filter<T>): Promise<WithId<T> | null>;
  findMany(query: Filter<T>, options?: QueryOptions): Promise<WithId<T>[]>;
  create(data: Partial<T>): Promise<WithId<T>>;
  update(id: string, data: Partial<T>): Promise<WithId<T> | null>;
  delete(id: string): Promise<boolean>;
  count(query: Filter<T>): Promise<number>;
}

export interface QueryOptions {
  sort?: Sort;
  limit?: number;
  skip?: number;
  select?: string[];
}