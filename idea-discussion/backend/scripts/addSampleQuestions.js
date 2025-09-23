import mongoose from "mongoose";
import SharpQuestion from "../models/SharpQuestion.js";
import Theme from "../models/Theme.js";

// MongoDB接続
const connectDB = async () => {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/idobata";
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

// サンプル質問データ
const sampleQuestions = [
  {
    questionText:
      "どうすれば、健康で活発な高齢者と年金制度の現状から、議論が健康に関わらず個人の人々や社会と考えていた政府の施策と主張や解決策として改革案を議論できるのか？",
    tagLine: "年金・医療・介護",
    tags: ["社会保障", "高齢者", "年金制度"],
    themeId: null, // デフォルトテーマのIDを後で設定
  },
  {
    questionText:
      "どうすれば、環境問題への意識が高まる中で、持続可能な社会を実現するための具体的な政策や取り組みを市民レベルで推進できるのか？",
    tagLine: "環境・エネルギー",
    tags: ["環境", "持続可能性", "エネルギー"],
    themeId: null,
  },
  {
    questionText:
      "どうすれば、地方創生と都市集中の問題を解決し、地域ごとの特色を活かした持続可能な発展を実現できるのか？",
    tagLine: "地方創生・都市計画",
    tags: ["地方創生", "都市計画", "地域活性化"],
    themeId: null,
  },
  {
    questionText:
      "どうすれば、AI技術の発展に伴う雇用の変化に対応し、全ての人が新しい時代に適応できる社会を作れるのか？",
    tagLine: "テクノロジー・雇用",
    tags: ["AI", "雇用", "テクノロジー"],
    themeId: null,
  },
  {
    questionText:
      "どうすれば、子育て世代が安心して働き続けられる環境を整備し、少子化問題に対処できるのか？",
    tagLine: "子育て・少子化対策",
    tags: ["子育て", "少子化", "働き方"],
    themeId: null,
  },
  {
    questionText:
      "どうすれば、教育格差を解消し、全ての子供が質の高い教育を受けられる社会を実現できるのか？",
    tagLine: "教育・格差",
    tags: ["教育", "格差", "平等"],
    themeId: null,
  },
  {
    questionText:
      "どうすれば、デジタルデバイドを解消し、高齢者も含めて全ての人がデジタル技術を活用できる社会を作れるのか？",
    tagLine: "デジタル・高齢者",
    tags: ["デジタル", "高齢者", "技術格差"],
    themeId: null,
  },
  {
    questionText:
      "どうすれば、働き方改革を進めながら、労働者の権利と企業の競争力を両立できるのか？",
    tagLine: "働き方改革・労働",
    tags: ["働き方改革", "労働", "企業"],
    themeId: null,
  },
];

const addSampleQuestions = async () => {
  try {
    await connectDB();

    // デフォルトテーマを取得
    const defaultTheme = await Theme.findOne({ slug: "default" });
    if (!defaultTheme) {
      console.error("デフォルトテーマが見つかりません");
      process.exit(1);
    }

    console.log(`デフォルトテーマID: ${defaultTheme._id}`);

    // 既存の質問をチェック
    const existingQuestions = await SharpQuestion.find({
      themeId: defaultTheme._id,
    });
    console.log(`既存の質問数: ${existingQuestions.length}`);

    if (existingQuestions.length > 0) {
      console.log("既に質問が存在します。スキップします。");
      process.exit(0);
    }

    // サンプル質問を追加
    const questionsToAdd = sampleQuestions.map((q) => ({
      ...q,
      themeId: defaultTheme._id,
    }));

    const result = await SharpQuestion.insertMany(questionsToAdd);
    console.log(`${result.length}個のサンプル質問を追加しました`);

    // 追加された質問を表示
    for (const question of result) {
      console.log(
        `- ${question.tagLine}: ${question.questionText.substring(0, 50)}...`
      );
    }
  } catch (error) {
    console.error("エラーが発生しました:", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB接続を閉じました");
  }
};

// スクリプトを実行
addSampleQuestions();
