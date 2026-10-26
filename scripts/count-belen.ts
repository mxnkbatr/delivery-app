import { config } from 'dotenv';
import { MongoClient } from 'mongodb';
config({ path: '.env.local' });

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  await client.connect();
  const col = client.db(process.env.MONGO_DB || 'Soyloo').collection('products');
  console.log({
    total: await col.countDocuments({}),
    sectionBelen: await col.countDocuments({ sections: 'Бэлэн' }),
    stockInStock: await col.countDocuments({ stockStatus: 'in-stock' }),
    stockPreOrder: await col.countDocuments({ stockStatus: 'pre-order' }),
    readyLogic: await col.countDocuments({
      $or: [
        { sections: 'Бэлэн' },
        { stockStatus: 'in-stock', sections: { $ne: 'Захиалга' } },
      ],
    }),
  });
  await client.close();
}
main();
