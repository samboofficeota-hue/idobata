import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-bold text-gray-800 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-gray-700 mb-4">
        ページが見つかりません
      </h2>
      <p className="text-gray-600 mb-8 max-w-md">
        お探しのページは存在しないか、移動または削除された可能性があります。
      </p>
      <div className="flex gap-4">
        <Link
          to="/top"
          className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          トップページに戻る
        </Link>
        <Link
          to="/themes"
          className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
        >
          テーマ一覧を見る
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
