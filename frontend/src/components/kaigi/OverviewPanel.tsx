import type { KaigiOverview } from "../../services/kaigi/types";

const List = ({ title, items }: { title: string; items: string[] }) => (
  <div>
    <h4 className="mb-1 text-sm font-bold text-primary-700">{title}</h4>
    {items.length > 0 ? (
      <ul className="list-disc space-y-1 pl-5 text-base">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-neutral-500">まだありません</p>
    )}
  </div>
);

// 工程3：みんなの声の整理（誰が言ったか・何人が言ったかは出さない）
const OverviewPanel = ({ overview }: { overview: KaigiOverview }) => (
  <div className="space-y-4">
    <p className="text-sm text-neutral-600">
      {overview.voiceCount > 0
        ? `ここまでに参加した人たちの声を整理しました（${overview.voiceCount}人分）。`
        : "まだほかの参加者の声がないため、お題と背景から考えられる候補を並べています。"}
    </p>
    <div className="grid gap-4 md:grid-cols-2">
      <List title="課題の候補" items={overview.issueCandidates} />
      <List title="解決アイディアの候補" items={overview.ideaCandidates} />
      <List title="意見が分かれているところ" items={overview.conflicts} />
      <List title="意見がそろっているところ" items={overview.agreements} />
    </div>
  </div>
);

export default OverviewPanel;
