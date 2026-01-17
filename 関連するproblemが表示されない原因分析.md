# 関連するproblemが表示されない原因分析

## 問題の状況

バックエンドの管理画面で「関連するproblem」の列に「関連データは取得中...」と表示され続けている。

## 原因

### 1. フロントエンド（管理画面）の問題

**ファイル:** `admin/src/components/theme/ThemeForm.tsx` (1059-1062行目)

```tsx
<td className="px-6 py-4 whitespace-normal text-sm text-muted-foreground">
  {/* We would fetch related problems here in a real implementation */}
  <span className="text-muted-foreground italic">
    関連データは取得中...
  </span>
</td>
```

**問題点:**
- コメントに「We would fetch related problems here in a real implementation」とある
- **実装されていない**（プレースホルダーのまま）
- 常に「関連データは取得中...」と表示される

### 2. バックエンドAPIの問題

**ファイル:** `idea-discussion/backend/controllers/questionController.js` (514-525行目)

```javascript
export const getQuestionsByTheme = async (req, res) => {
  const { themeId } = req.params;
  
  try {
    const questions = await SharpQuestion.find({ themeId }).sort({
      createdAt: -1,
    });
    res.status(200).json(questions);  // ⭐ relatedProblemsCountが含まれていない
  } catch (error) {
    // ...
  }
};
```

**問題点:**
- `getQuestionsByTheme` APIは、質問のリストを返すだけ
- `relatedProblemsCount`や`relatedSolutionsCount`などの情報が含まれていない
- 管理画面は`getQuestionsByTheme`を使って質問を取得しているが、関連データの情報が得られない

### 3. 他のAPIとの比較

**`getThemeDetail` API（実装済み）:**
```javascript
// idea-discussion/backend/controllers/themeController.js (276-307行目)
const keyQuestionsWithCounts = await Promise.all(
  keyQuestions.map(async (question) => {
    const issueCount = await QuestionLink.countDocuments({
      questionId,
      linkedItemType: "problem",
    });
    
    const solutionCount = await QuestionLink.countDocuments({
      questionId,
      linkedItemType: "solution",
    });
    
    return {
      ...question.toObject(),
      issueCount,      // ⭐ 関連するproblemの数
      solutionCount,   // ⭐ 関連するsolutionの数
      postCount,
      voteCount,
    };
  })
);
```

**`getDownloadOutput` API（実装済み）:**
```javascript
// idea-discussion/backend/controllers/adminController.js (468-469行目)
relatedProblemsCount: problemLinks.length,
relatedSolutionsCount: solutionLinks.length,
```

**`getTopPageData` API（実装済み）:**
```javascript
// idea-discussion/backend/controllers/topPageController.js (191-199行目)
const issueCount = await QuestionLink.countDocuments({
  questionId,
  linkedItemType: "problem",
});

const solutionCount = await QuestionLink.countDocuments({
  questionId,
  linkedItemType: "solution",
});
```

## 解決策

### 案1: `getQuestionsByTheme` APIを修正（推奨）

**修正内容:**
- `getQuestionsByTheme` APIで、各質問に対して`relatedProblemsCount`と`relatedSolutionsCount`を計算して返す
- `getThemeDetail`や`getTopPageData`と同じロジックを使用

**実装例:**
```javascript
export const getQuestionsByTheme = async (req, res) => {
  const { themeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ message: "Invalid theme ID format" });
  }

  try {
    const questions = await SharpQuestion.find({ themeId }).sort({
      createdAt: -1,
    });

    // 各質問に関連するProblemとSolutionの数を計算
    const questionsWithCounts = await Promise.all(
      questions.map(async (question) => {
        const questionId = question._id;

        const relatedProblemsCount = await QuestionLink.countDocuments({
          questionId,
          linkedItemType: "problem",
        });

        const relatedSolutionsCount = await QuestionLink.countDocuments({
          questionId,
          linkedItemType: "solution",
        });

        return {
          ...question.toObject(),
          relatedProblemsCount,
          relatedSolutionsCount,
        };
      })
    );

    res.status(200).json(questionsWithCounts);
  } catch (error) {
    console.error(`Error fetching questions for theme ${themeId}:`, error);
    res.status(500).json({
      message: "Error fetching theme questions",
      error: error.message,
    });
  }
};
```

### 案2: フロントエンドの型定義を更新

**修正内容:**
- `admin/src/services/api/types.ts`の`Question`インターフェースに`relatedProblemsCount`と`relatedSolutionsCount`を追加

**実装例:**
```typescript
export interface Question {
  _id: string;
  themeId: string;
  questionText: string;
  tagLine?: string;
  tags?: string[];
  isVisible?: boolean;
  createdAt: string;
  updatedAt: string;
  relatedProblemsCount?: number;  // ⭐ 追加
  relatedSolutionsCount?: number; // ⭐ 追加
}
```

### 案3: フロントエンドの表示を修正

**修正内容:**
- `ThemeForm.tsx`で、`question.relatedProblemsCount`を表示

**実装例:**
```tsx
<td className="px-6 py-4 whitespace-normal text-sm text-muted-foreground">
  {question.relatedProblemsCount !== undefined
    ? `${question.relatedProblemsCount}件`
    : "関連データは取得中..."}
</td>
```

## 親リポジトリとの比較

親リポジトリ（digitaldemocracy2030/idobata）でも同様の問題がある可能性が高い：
- コメント「We would fetch related problems here in a real implementation」が残っている
- `getQuestionsByTheme` APIが`relatedProblemsCount`を返していない

ただし、他のAPI（`getThemeDetail`、`getTopPageData`、`getDownloadOutput`）では実装されているため、同じロジックを`getQuestionsByTheme`にも適用すれば解決できる。

## まとめ

**原因:**
1. フロントエンドで実装されていない（プレースホルダーのまま）
2. バックエンドの`getQuestionsByTheme` APIが`relatedProblemsCount`を返していない

**解決策:**
1. `getQuestionsByTheme` APIを修正して`relatedProblemsCount`と`relatedSolutionsCount`を返す
2. フロントエンドの型定義を更新
3. フロントエンドの表示を修正
