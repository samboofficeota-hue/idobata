Ra;
!/usr/bin / env;
node;
import mongoose from 'mongoose';
import dotenv from 'dotenv';
// Load environment variables
dotenv.config();
console.log('=== MongoDB接続テスト ===');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '設定済み' : '未設定');
if (!process.env.MONGODB_URI) {
    console.log('❌ MONGODB_URI環境変数が設定されていません');
    process.exit(1);
}
try {
    console.log('接続試行中...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB接続成功');
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('📊 コレクション数:', collections.length);
    await mongoose.disconnect();
    console.log('✅ 接続終了');
}
catch (err) {
    console.log('❌ MongoDB接続エラー:', err.message);
    console.log('エラー詳細:', err);
    process.exit(1);
}
//# sourceMappingURL=test-mongodb.js.map