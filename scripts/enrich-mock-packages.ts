import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const db = client.db(process.env.MONGO_DB || 'Soyloo');
  const orders = db.collection('orders');
  const mocks = await orders.find({ mockSeed: 'courier_mock_99111111' }).toArray();
  const variants = [
    {
      packageCategory: 'general',
      packageSize: 'small',
      packageCount: 1,
      packageHandling: { upright: true, nonBreakable: true },
    },
    {
      packageCategory: 'food',
      packageSize: 'medium',
      packageCount: 2,
      packageHandling: { coldChain: true },
    },
    {
      packageCategory: 'electronics',
      packageSize: 'medium',
      packageCount: 1,
      packageHandling: { fragile: true, upright: true },
    },
    {
      packageCategory: 'general',
      packageSize: 'large',
      packageCount: 3,
      packageHandling: { horizontal: true },
    },
    {
      packageCategory: 'food',
      packageSize: 'small',
      packageCount: 1,
      packageHandling: { coldChain: true, fragile: true },
    },
  ];
  let i = 0;
  for (const o of mocks) {
    await orders.updateOne({ _id: o._id }, { $set: variants[i % variants.length] });
    i += 1;
  }
  console.log('Updated', mocks.length, 'mock packages');
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
