import mongoose from "mongoose"; // Import mongoose for ObjectId validation
import { v4 as uuidv4 } from "uuid"; // For generating temporary user IDs
import ChatThread from "../models/ChatThread.js";
import QuestionLink from "../models/QuestionLink.js"; // Import QuestionLink model
import SharpQuestion from "../models/SharpQuestion.js"; // Import SharpQuestion model
import Theme from "../models/Theme.js"; // Import Theme model for custom prompts
import { callLLM } from "../services/llmService.js"; // Import the LLM service
import { getQualityOpinionsForChat } from "../workers/dailyBatchProcessor.js"; // Import batch processor for quality opinions
import { processExtraction } from "../workers/extractionWorker.js"; // Import the extraction worker function

// Controller function for handling new chat messages by theme
const handleNewMessageByTheme = async (req, res) => {
  const { themeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ error: "Invalid theme ID format" });
  }

  try {
    let { userId, message, threadId, questionId, context } = req.body;

    // Validate input
    if (!message) {
      return res.status(400).json({ error: "Message content is required." });
    }

    // Generate a temporary userId if not provided
    if (!userId) {
      userId = `temp_${uuidv4()}`;
      console.log(`Generated temporary userId: ${userId}`);
    }

    let chatThread;

    if (threadId) {
      // If threadId is provided, find the existing thread
      console.log(`Looking for existing chat thread with ID: ${threadId}`);
      chatThread = await ChatThread.findById(threadId);
      if (!chatThread) {
        console.error(`Chat thread with ID ${threadId} not found.`);
        return res.status(404).json({ error: "Chat thread not found." });
      }

      if (!chatThread.themeId || chatThread.themeId.toString() !== themeId) {
        console.error(`Thread ${threadId} does not belong to theme ${themeId}`);
        return res
          .status(403)
          .json({ error: "Thread does not belong to the specified theme." });
      }

      // Optional: Verify if the userId matches the thread's userId if needed for security
      if (chatThread.userId !== userId) {
        console.warn(
          `User ID mismatch for thread ${threadId}. Request userId: ${userId}, Thread userId: ${chatThread.userId}`
        );
      }
      console.log(`Found existing chat thread with ID: ${threadId}`);
    } else {
      // If no threadId is provided, create a new thread
      console.log(
        `Creating new chat thread for userId: ${userId} in theme: ${themeId}`
      );
      chatThread = new ChatThread({
        userId: userId,
        sessionId: `session_${uuidv4()}`, // Generate a unique session ID
        messages: [],
        extractedProblemIds: [],
        extractedSolutionIds: [],
        themeId: themeId, // Add themeId to the new thread
      });
    }

    // Add user message to the thread
    chatThread.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    // --- Fetch Reference Opinions (Sharp Questions and related Problems/Solutions) ---
    let referenceOpinions = "";

    if (
      context === "question" &&
      questionId &&
      mongoose.Types.ObjectId.isValid(questionId)
    ) {
      try {
        const question = await SharpQuestion.findById(questionId).lean();
        if (question) {
          referenceOpinions +=
            "現在の議論対象となっている「問い」について:\n\n";
          referenceOpinions += `問い: ${question.questionText}\n`;
          if (question.tagLine) {
            referenceOpinions += `概要: ${question.tagLine}\n`;
          }
          referenceOpinions += "\n";

          const problemLinks = await QuestionLink.aggregate([
            {
              $match: {
                questionId: question._id,
                linkedItemType: "problem",
                linkType: "prompts_question",
                relevanceScore: { $gte: 0.8 },
              },
            },
            { $sort: { relevanceScore: -1 } }, // Sort by relevance score descending
            { $limit: 15 }, // Get top 15 most relevant
            {
              $lookup: {
                from: "problems",
                localField: "linkedItemId",
                foreignField: "_id",
                as: "linkedProblem",
              },
            },
            {
              $unwind: {
                path: "$linkedProblem",
                preserveNullAndEmptyArrays: true,
              },
            },
          ]);

          if (
            problemLinks.length > 0 &&
            problemLinks.some((link) => link.linkedProblem)
          ) {
            referenceOpinions += "この問いに関連性の高い課題 (関連度 >=80%):\n";
            for (const link of problemLinks) {
              if (link.linkedProblem) {
                const problem = link.linkedProblem;
                if (problem.themeId && problem.themeId.toString() === themeId) {
                  const statement =
                    problem.statement ||
                    problem.combinedStatement ||
                    problem.statementA ||
                    problem.statementB ||
                    "N/A";
                  const relevancePercent = Math.round(
                    link.relevanceScore * 100
                  );
                  referenceOpinions += `  - ${statement} (関連度: ${relevancePercent}%)\n`;
                }
              }
            }
          } else {
            referenceOpinions += "この問いに関連性の高い課題: (ありません)\n";
          }

          const solutionLinks = await QuestionLink.aggregate([
            {
              $match: {
                questionId: question._id,
                linkedItemType: "solution",
                linkType: "answers_question",
                relevanceScore: { $gte: 0.8 },
              },
            },
            { $sort: { relevanceScore: -1 } }, // Sort by relevance score descending
            { $limit: 15 }, // Get top 15 most relevant
            {
              $lookup: {
                from: "solutions",
                localField: "linkedItemId",
                foreignField: "_id",
                as: "linkedSolution",
              },
            },
            {
              $unwind: {
                path: "$linkedSolution",
                preserveNullAndEmptyArrays: true,
              },
            },
          ]);

          if (
            solutionLinks.length > 0 &&
            solutionLinks.some((link) => link.linkedSolution)
          ) {
            referenceOpinions +=
              "この問いに関連性の高い解決策 (関連度 >=80%):\n";
            for (const link of solutionLinks) {
              if (link.linkedSolution) {
                const solution = link.linkedSolution;
                if (
                  solution.themeId &&
                  solution.themeId.toString() === themeId
                ) {
                  const relevancePercent = Math.round(
                    link.relevanceScore * 100
                  );
                  referenceOpinions += `  - ${solution.statement || "N/A"} (関連度: ${relevancePercent}%)\n`;
                }
              }
            }
          } else {
            referenceOpinions += "この問いに関連性の高い解決策: (ありません)\n";
          }

          referenceOpinions +=
            "\n---\nこの特定の「問い」と関連する課題・解決策を踏まえ、ユーザーとの対話を深めてください。\n";
        }
      } catch (dbError) {
        console.error(
          `Error fetching question-specific context for question ${questionId}:`,
          dbError
        );
        // Fall back to theme-level context if question-specific fetch fails
      }
    } else {
      try {
        // バッチ処理で選別された品質の高い意見を取得
        const { problems: qualityProblems, solutions: qualitySolutions } =
          await getQualityOpinionsForChat(themeId, 10);

        const themeQuestions = await SharpQuestion.find({ themeId }).lean();

        if (
          themeQuestions.length > 0 ||
          qualityProblems.length > 0 ||
          qualitySolutions.length > 0
        ) {
          referenceOpinions +=
            "参考情報として、システム内で議論されている主要な「問い」と、それに関連する意見の一部を紹介します:\n\n";

          // 問いがある場合は表示
          if (themeQuestions.length > 0) {
            for (const question of themeQuestions) {
              referenceOpinions += `問い: ${question.questionText}\n`;
            }
            referenceOpinions += "\n";
          }

          // 品質の高い問題を表示
          if (qualityProblems.length > 0) {
            referenceOpinions += "関連性の高い課題:\n";
            for (const problem of qualityProblems) {
              const statement =
                problem.statement ||
                problem.combinedStatement ||
                problem.statementA ||
                problem.statementB ||
                "N/A";
              referenceOpinions += `  - ${statement}\n`;
            }
            referenceOpinions += "\n";
          }

          // 品質の高い解決策を表示
          if (qualitySolutions.length > 0) {
            referenceOpinions += "関連性の高い解決策:\n";
            for (const solution of qualitySolutions) {
              referenceOpinions += `  - ${solution.statement || "N/A"}\n`;
            }
            referenceOpinions += "\n";
          }

          referenceOpinions +=
            "---\nこれらの「問い」や関連意見も踏まえ、ユーザーとの対話を深めてください。\n";
        }
      } catch (dbError) {
        console.error(
          `Error fetching reference opinions for theme ${themeId}:`,
          dbError
        );
        // Continue without reference opinions if DB fetch fails
      }
    }
    // --- End Fetch Reference Opinions ---

    // --- Call LLM for AI Response ---
    // Prepare messages for the LLM (ensure correct format)
    const llmMessages = [];

    // --- Get theme and determine system prompt ---
    let systemPrompt = "";
    try {
      const theme = await Theme.findById(themeId);
      if (theme?.customPrompt) {
        systemPrompt = theme.customPrompt;
      } else {
        // --- Use default system prompt ---
        systemPrompt = `あなたは「課題を解決するアシスタント」ではありません。
あなたの役割は、ユーザー自身が課題と解決策を言語化するための
**対話の進行役（ファシリテーター）**です。

以下の【フェーズ制御ルール】を厳守してください。

────────────────
【フェーズ制御ルール】
────────────────

■ Phase 1：課題の材料収集フェーズ
- このフェーズでは、**質問のみ**を行ってください。
- 課題の要約、仮説、整理、解決策の提示は一切禁止です。
- ユーザーの状況・背景・困りごとを引き出すことに専念してください。
- 質問は1回につき1〜2問まで、最大4文以内とします。

使用可能な問いの例：
・それはいつ頃から起きていますか？
・誰が一番困っていますか？
・今、何が一番うまくいっていませんか？
・理想と比べて、どこに違和感がありますか？

※ このフェーズは原則2〜3往復行います。

────────────────
■ Phase 2：課題の言語化確認フェーズ
- ユーザーからの情報が十分に出揃ったと判断した場合のみ、このフェーズに進んでください。
- ここで初めて、次の形式で要約を提示してよいものとします。

提示形式：
「ここまでのお話を整理すると、
あなたの課題は『〇〇が△△な状況にあり、その結果□□が起きている』という点ですね。
この理解で合っていますか？」

- 新しい論点や解釈は加えないでください。

────────────────
■ Phase 3：解決アイディア有無の確認フェーズ
- 課題の認識が合意された後、次の問いのみを投げかけてください。

「この課題について、すでに考えている解決アイディアはありますか？
　思いつく範囲で構いません。」

- この時点では、AIからの解決案提示は禁止です。

────────────────
■ Phase 4：解決策の具体化フェーズ（条件付き）
- ユーザーから複数、または具体的な解決アイディアが出た場合のみ進行します。
- 5W1Hを使い、1つずつ具体化してください。
- 1ターンで扱う解決策は1つまでとします。

使用例：
・それは誰が主体になりますか？
・いつ頃実行する想定ですか？
・なぜその方法が有効だと思いますか？

────────────────
■ Phase 5：終了条件
- ユーザーが「特にアイディアはない」「これ以上は考えられない」と述べた場合、
　深追いせず、次の形で会話を終了してください。

「ここまでで、課題の輪郭は十分に言語化できたと思います。
　また考えたくなったタイミングで、続きを一緒に整理しましょう。」

────────────────

【共通ルール】
- 回答は常に最大4文以内。
- 心理的安全性を最優先すること。
- ユーザーの思考を"代行"しないこと。
`;
      }
    } catch (error) {
      console.error(`Error fetching theme ${themeId} for prompt:`, error);
      systemPrompt = `あなたは「課題を解決するアシスタント」ではありません。
あなたの役割は、ユーザー自身が課題と解決策を言語化するための
**対話の進行役（ファシリテーター）**です。

以下の【フェーズ制御ルール】を厳守してください。

────────────────
【フェーズ制御ルール】
────────────────

■ Phase 1：課題の材料収集フェーズ
- このフェーズでは、**質問のみ**を行ってください。
- 課題の要約、仮説、整理、解決策の提示は一切禁止です。
- ユーザーの状況・背景・困りごとを引き出すことに専念してください。
- 質問は1回につき1〜2問まで、最大4文以内とします。

使用可能な問いの例：
・それはいつ頃から起きていますか？
・誰が一番困っていますか？
・今、何が一番うまくいっていませんか？
・理想と比べて、どこに違和感がありますか？

※ このフェーズは原則2〜3往復行います。

────────────────
■ Phase 2：課題の言語化確認フェーズ
- ユーザーからの情報が十分に出揃ったと判断した場合のみ、このフェーズに進んでください。
- ここで初めて、次の形式で要約を提示してよいものとします。

提示形式：
「ここまでのお話を整理すると、
あなたの課題は『〇〇が△△な状況にあり、その結果□□が起きている』という点ですね。
この理解で合っていますか？」

- 新しい論点や解釈は加えないでください。

────────────────
■ Phase 3：解決アイディア有無の確認フェーズ
- 課題の認識が合意された後、次の問いのみを投げかけてください。

「この課題について、すでに考えている解決アイディアはありますか？
　思いつく範囲で構いません。」

- この時点では、AIからの解決案提示は禁止です。

────────────────
■ Phase 4：解決策の具体化フェーズ（条件付き）
- ユーザーから複数、または具体的な解決アイディアが出た場合のみ進行します。
- 5W1Hを使い、1つずつ具体化してください。
- 1ターンで扱う解決策は1つまでとします。

使用例：
・それは誰が主体になりますか？
・いつ頃実行する想定ですか？
・なぜその方法が有効だと思いますか？

────────────────
■ Phase 5：終了条件
- ユーザーが「特にアイディアはない」「これ以上は考えられない」と述べた場合、
　深追いせず、次の形で会話を終了してください。

「ここまでで、課題の輪郭は十分に言語化できたと思います。
　また考えたくなったタイミングで、続きを一緒に整理しましょう。」

────────────────

【共通ルール】
- 回答は常に最大4文以内。
- 心理的安全性を最優先すること。
- ユーザーの思考を"代行"しないこと。
`;
    }

    llmMessages.push({ role: "system", content: systemPrompt });
    // --- End core system prompt ---

    // Add the reference opinions as a system message
    if (referenceOpinions) {
      llmMessages.push({ role: "system", content: referenceOpinions });
    }

    // Add actual chat history
    llmMessages.push(
      ...chatThread.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))
    );

    // Call the LLM service
    const aiResponseContent = await callLLM(llmMessages);

    if (!aiResponseContent) {
      console.error("LLM did not return a response.");
      return res
        .status(500)
        .json({ error: "AI failed to generate a response." });
    }

    // Add AI response to the thread
    chatThread.messages.push({
      role: "assistant",
      content: aiResponseContent,
      timestamp: new Date(),
    });
    // --- End LLM Call ---

    // Save the updated thread
    await chatThread.save();
    console.log(`Saved chat thread for userId: ${userId} in theme: ${themeId}`);

    // --- Trigger asynchronous extraction ---
    setTimeout(() => {
      const job = {
        data: {
          sourceType: "chat",
          sourceOriginId: chatThread._id.toString(),
          content: null,
          metadata: {},
          themeId: themeId, // Include themeId in job data
        },
      };

      processExtraction(job).catch((err) => {
        console.error(
          `[Async Extraction Call] Error for thread ${chatThread._id} in theme ${themeId}:`,
          err
        );
      });
    }, 0);
    // --- End Trigger ---

    // Return the response
    const responsePayload = {
      response: aiResponseContent,
      threadId: chatThread._id,
    };
    if (req.body.userId !== userId) {
      responsePayload.userId = userId;
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error(`Error handling new message for theme ${themeId}:`, error);
    res
      .status(500)
      .json({ error: "Internal server error while processing message." });
  }
};

// Controller function for getting extractions for a specific thread by theme
const getThreadExtractionsByTheme = async (req, res) => {
  const { themeId, threadId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ error: "Invalid theme ID format" });
  }

  if (!threadId) {
    return res.status(400).json({ error: "Thread ID is required." });
  }

  try {
    // Find the chat thread and populate the extracted problems and solutions
    const chatThread = await ChatThread.findById(threadId)
      .populate("extractedProblemIds")
      .populate("extractedSolutionIds");

    if (!chatThread) {
      return res.status(404).json({ error: "Chat thread not found." });
    }

    if (!chatThread.themeId || chatThread.themeId.toString() !== themeId) {
      console.error(`Thread ${threadId} does not belong to theme ${themeId}`);
      return res
        .status(403)
        .json({ error: "Thread does not belong to the specified theme." });
    }

    // Return the populated problems and solutions
    res.status(200).json({
      problems: chatThread.extractedProblemIds || [],
      solutions: chatThread.extractedSolutionIds || [],
    });
  } catch (error) {
    console.error(
      `Error getting thread extractions for theme ${themeId}:`,
      error
    );
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid Thread ID format." });
    }
    res
      .status(500)
      .json({ error: "Internal server error while getting extractions." });
  }
};

// Controller function for getting a thread's messages by theme
const getThreadMessagesByTheme = async (req, res) => {
  const { themeId, threadId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ error: "Invalid theme ID format" });
  }

  if (!threadId) {
    return res.status(400).json({ error: "Thread ID is required." });
  }

  try {
    // Find the chat thread
    const chatThread = await ChatThread.findById(threadId);

    if (!chatThread) {
      return res.status(404).json({ error: "Chat thread not found." });
    }

    if (!chatThread.themeId || chatThread.themeId.toString() !== themeId) {
      console.error(`Thread ${threadId} does not belong to theme ${themeId}`);
      return res
        .status(403)
        .json({ error: "Thread does not belong to the specified theme." });
    }

    // Return the thread's messages
    res.status(200).json({
      threadId: chatThread._id,
      userId: chatThread.userId,
      themeId: chatThread.themeId,
      messages: chatThread.messages || [],
    });
  } catch (error) {
    console.error(`Error getting thread messages for theme ${themeId}:`, error);
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid Thread ID format." });
    }
    res
      .status(500)
      .json({ error: "Internal server error while getting thread messages." });
  }
};

// Controller function for getting a thread by user and question
const getThreadByUserAndQuestion = async (req, res) => {
  const { userId, questionId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  if (!questionId) {
    return res.status(400).json({ error: "Question ID is required" });
  }

  // Validate questionId
  if (!mongoose.Types.ObjectId.isValid(questionId)) {
    return res.status(400).json({ error: "Invalid question ID format" });
  }

  try {
    // First, get the question to find the themeId
    const question = await SharpQuestion.findById(questionId);
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    const themeId = question.themeId;

    // Build query object
    const query = {
      userId: userId,
      questionId: questionId,
    };

    const chatThread = await ChatThread.findOne(query);

    if (!chatThread) {
      const newChatThread = new ChatThread({
        themeId: themeId,
        userId: userId,
        questionId: questionId,
        messages: [],
        sessionId: `session_${Date.now()}`, // 一時的なセッションID
      });

      await newChatThread.save();

      return res.status(200).json({
        threadId: newChatThread._id,
        userId: userId,
        themeId: themeId,
        questionId: questionId,
        messages: [],
      });
    }

    return res.status(200).json({
      threadId: chatThread._id,
      userId: chatThread.userId,
      themeId: chatThread.themeId,
      questionId: chatThread.questionId,
      messages: chatThread.messages || [],
    });
  } catch (error) {
    console.error(
      `Error getting thread for user ${userId} and question ${questionId}:`,
      error
    );
    return res.status(500).json({
      error: "Internal server error while getting thread messages.",
    });
  }
};

// Controller function for getting a thread by user and theme (for theme-level chats)
const getThreadByUserAndTheme = async (req, res) => {
  const { themeId } = req.params;
  const { userId } = req.query;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ error: "Invalid theme ID format" });
  }

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    // For theme-level chats, we don't use questionId
    const query = {
      themeId: themeId,
      userId: userId,
      questionId: null, // Explicitly exclude question-specific threads
    };

    const chatThread = await ChatThread.findOne(query);

    if (!chatThread) {
      const newChatThread = new ChatThread({
        themeId: themeId,
        userId: userId,
        questionId: null,
        messages: [],
        sessionId: `session_${Date.now()}`, // 一時的なセッションID
      });

      await newChatThread.save();

      return res.status(200).json({
        threadId: newChatThread._id,
        userId: userId,
        themeId: themeId,
        messages: [],
      });
    }

    return res.status(200).json({
      threadId: chatThread._id,
      userId: chatThread.userId,
      themeId: chatThread.themeId,
      messages: chatThread.messages || [],
    });
  } catch (error) {
    console.error(
      `Error getting thread for user ${userId} and theme ${themeId}:`,
      error
    );
    return res.status(500).json({
      error: "Internal server error while getting thread messages.",
    });
  }
};

// Controller function for manually triggering extraction for a thread
const triggerExtractionForThread = async (req, res) => {
  const { themeId, threadId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(themeId)) {
    return res.status(400).json({ error: "Invalid theme ID format" });
  }

  if (!threadId) {
    return res.status(400).json({ error: "Thread ID is required." });
  }

  try {
    // Find the chat thread
    const chatThread = await ChatThread.findById(threadId);

    if (!chatThread) {
      return res.status(404).json({ error: "Chat thread not found." });
    }

    if (!chatThread.themeId || chatThread.themeId.toString() !== themeId) {
      console.error(`Thread ${threadId} does not belong to theme ${themeId}`);
      return res
        .status(403)
        .json({ error: "Thread does not belong to the specified theme." });
    }

    // Check if thread has enough content (at least 2 user messages)
    const userMessages = chatThread.messages.filter(
      (msg) => msg.role === "user"
    );
    if (userMessages.length < 2) {
      return res.status(400).json({
        error:
          "Insufficient content. Please provide more input before submitting.",
      });
    }

    // Trigger extraction
    const job = {
      data: {
        sourceType: "chat",
        sourceOriginId: chatThread._id.toString(),
        content: null,
        metadata: {},
        themeId: themeId,
      },
    };

    processExtraction(job).catch((err) => {
      console.error(
        `[Manual Extraction Call] Error for thread ${chatThread._id} in theme ${themeId}:`,
        err
      );
    });

    res.status(200).json({
      message: "Extraction triggered successfully",
      threadId: chatThread._id,
    });
  } catch (error) {
    console.error(
      `Error triggering extraction for thread ${threadId} in theme ${themeId}:`,
      error
    );
    res.status(500).json({
      error: "Internal server error while triggering extraction.",
    });
  }
};

export {
  getThreadExtractionsByTheme,
  getThreadMessagesByTheme,
  handleNewMessageByTheme,
  getThreadByUserAndTheme,
  getThreadByUserAndQuestion,
  triggerExtractionForThread,
};
