// 広聴AI（kouchou-ai）APIのレスポンス型
// kouchou-ai/client/type.d.ts のうち、表示に必要な項目のみを定義している

export type KouchouReport = {
  slug: string;
  status: string;
  title: string;
  description: string;
  isPubcom: boolean;
  visibility: "public" | "private" | "unlisted";
  createdAt?: string;
};

export type KouchouArgument = {
  arg_id: string;
  argument: string;
  comment_id: number;
  x: number;
  y: number;
  p: number;
  cluster_ids: string[];
  url?: string;
};

export type KouchouCluster = {
  level: number;
  id: string;
  label: string;
  takeaway: string;
  value: number;
  parent: string;
  density_rank_percentile?: number;
};

export type KouchouConfig = {
  name: string;
  question: string;
  intro?: string;
  model: string;
};

export type KouchouResult = {
  arguments: KouchouArgument[];
  clusters: KouchouCluster[];
  overview: string;
  config: KouchouConfig;
  comment_num?: number;
};
