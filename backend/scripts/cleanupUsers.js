const mongoose = require('mongoose');
const path = require('path');

// adjust if your models path differs
const User = require(path.join(__dirname, '..', 'models', 'users'));

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/heron';

async function main() {
  console.log('Connecting to', MONGO_URI);
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    // 1) Remove invalid interactionHistory entries with action "unlike"
    const pullRes = await User.updateMany(
      {},
      { $pull: { interactionHistory: { action: 'unlike' } } }
    );
    console.log(`Removed 'unlike' from interactionHistory in ${pullRes.modifiedCount} user(s).`);

    // 2) Add placeholder studentId for users missing it (only if field is required in schema)
    const usersMissing = await User.find({ studentId: { $exists: false } }).select('_id').lean();
    console.log(`Found ${usersMissing.length} user(s) missing studentId.`);

    let updatedStudentCount = 0;
    for (const u of usersMissing) {
      const placeholder = `unknown-${u._id.toString().slice(-8)}`;
      const upd = await User.updateOne({ _id: u._id }, { $set: { studentId: placeholder } });
      if (upd.modifiedCount) updatedStudentCount++;
    }
    console.log(`Set placeholder studentId for ${updatedStudentCount} user(s).`);

    // 3) Optional: trim imageHistory to keep last N entries per user (example: keep 10)
    const TRIM_KEEP = 10;
    const cursor = User.find({ imageHistory: { $exists: true, $not: { $size: 0 } } }).cursor();
    let touched = 0;
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      const grouped = {};
      for (const item of doc.imageHistory || []) {
        grouped[item.type] = grouped[item.type] || [];
        grouped[item.type].push(item);
      }
      let changed = false;
      const newHistory = [];
      Object.keys(grouped).forEach(type => {
        const arr = grouped[type];
        // keep first TRIM_KEEP entries (we push newest at front elsewhere)
        if (arr.length > TRIM_KEEP) {
          changed = true;
          newHistory.push(...arr.slice(0, TRIM_KEEP));
        } else {
          newHistory.push(...arr);
        }
      });
      if (changed) {
        await User.updateOne({ _id: doc._id }, { $set: { imageHistory: newHistory } });
        touched++;
      }
    }
    console.log(`Trimmed imageHistory for ${touched} user(s).`);

    console.log('Cleanup complete.');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();