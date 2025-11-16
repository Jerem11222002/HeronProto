const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
const mongoose = require('mongoose');
const Event = require('../models/event');

const MONGO = process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/heronproto';

async function migrate() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB');

  const allowed = ['upcoming','ongoing','completed','cancelled'];
  const docs = await Event.find({ status: { $exists: true } }).lean();
  let updated = 0;

  for (const d of docs) {
    const s = String(d.status || '').trim();
    const lower = s.toLowerCase();
    if (s && s !== lower) {
      const final = allowed.includes(lower) ? lower : 'upcoming';
      await Event.updateOne({ _id: d._id }, { $set: { status: final } });
      console.log(`Normalized ${d._id}: "${s}" -> "${final}"`);
      updated++;
    }
  }

  console.log(`Migration complete. Updated ${updated} documents.`);
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration error', err);
  process.exit(1);
});

