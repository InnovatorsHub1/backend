import { MongoClient, Collection, ObjectId } from 'mongodb';
import { BaseRepository } from '../../../src/repositories/BaseRepository';

interface TestDocument {
  _id?: string | ObjectId;
  name: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

jest.setTimeout(60000); // Set Jest timeout to 60 seconds

describe('BaseRepository', () => {
  let client: MongoClient;
  let collection: Collection<TestDocument>;
  let repository: BaseRepository<TestDocument>;

  beforeAll(async () => {
    try {
      console.log('Connecting to MongoDB...');
      client = await MongoClient.connect(
        process.env.MONGO_URI || 'mongodb://admin:password@localhost:27017/test?authSource=admin'
      );
      console.log('MongoDB connected');
      collection = client.db('test').collection('test');
      repository = new BaseRepository<TestDocument>(collection);
    } catch (error) {
      console.error('MongoDB Connection Error:', error);
      throw error;
    }
  }, 60000);

  afterAll(async () => {
    try {
      if (collection) {
        await collection.drop();
        console.log('Collection dropped');
      }
      if (client) {
        await client.close();
        console.log('MongoDB connection closed');
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  });

  beforeEach(async () => {
    await collection.deleteMany({});
  });

  it('should create document', async () => {
    const doc = await repository.create({
      name: 'test',
      isDeleted: false,
    });
    expect(doc._id).toBeDefined();
    expect(doc.name).toBe('test');
    expect(doc.isDeleted).toBe(false);
    expect(doc.createdAt).toBeDefined();
    expect(doc.updatedAt).toBeDefined();
  });

  it('should find document', async () => {
    const created = await repository.create({
      name: 'test',
      isDeleted: false,
    });
    const found = await repository.findOne({ _id: created._id });
    expect(found?.name).toBe('test');
  });

  it('should update document', async () => {
    const doc = await repository.create({
      name: 'test',
      isDeleted: false,
    });
    const updated = await repository.update(doc._id.toString(), { name: 'updated' });
    expect(updated?.name).toBe('updated');
  });

  it('should soft delete document', async () => {
    const doc = await repository.create({
      name: 'test',
      isDeleted: false,
    });
    await repository.delete(doc._id.toString());
    const found = await repository.findOne({ _id: doc._id });
    expect(found).toBeNull();
  });

  it('should paginate results', async () => {
    await Promise.all([
      repository.create({ name: 'test1', isDeleted: false }),
      repository.create({ name: 'test2', isDeleted: false }),
      repository.create({ name: 'test3', isDeleted: false }),
    ]);

    const { items, total } = await repository.paginate({}, 1, 2);
    expect(items.length).toBe(2);
    expect(total).toBe(3);
  });
});