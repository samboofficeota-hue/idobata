import mongoose from "mongoose"; // Import mongoose for ObjectId validation
import { v4 as uuidv4 } from "uuid"; // For generating temporary user IDs
import ChatThread from "../models/ChatThread.js";
import QuestionLink from "../models/QuestionLink.js"; // Import QuestionLink model
import SharpQuestion from "../models/SharpQuestion.js"; // Import SharpQuestion model
import Theme from "../models/Theme.js"; // Import Theme model for custom prompts
import { callLLM } from "../services/llmService.js"; // Import the LLM service
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
        // テーマ単位: その場で QuestionLink を aggregate し、問いごとに関連度 0.8 以上の課題・解決策を渡す（フォーク元と同様の方式）
        const themeQuestions = await SharpQuestion.find({ themeId }).lean();

        if (themeQuestions.length > 0) {
          referenceOpinions +=
            "【参考情報】他ユーザーの意見から整理された論点です。対話の視点のヒントとして使ってください。質問のテンプレートではなく、そのまま読み上げたり機械的に順番に聞いたりしないでください。\n\n";

          for (const question of themeQuestions) {
            referenceOpinions += `問い: ${question.questionText}\n`;

            // この問いに関連する課題（関連度 0.8 以上、最大10件を $sample）
            const problemLinks = await QuestionLink.aggregate([
              {
                $match: {
                  questionId: question._id,
                  linkedItemType: "problem",
                  linkType: "prompts_question",
                  relevanceScore: { $gte: 0.8 },
                },
              },
              { $sample: { size: 10 } },
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
                  preserveNullAndEmptyArrays: false,
                },
              },
            ]);

            const problemStatements = [];
            for (const link of problemLinks) {
              const problem = link.linkedProblem;
              if (
                problem.themeId &&
                problem.themeId.toString() === themeId
              ) {
                const statement =
                  problem.statement ||
                  problem.combinedStatement ||
                  problem.statementA ||
                  problem.statementB ||
                  "N/A";
                problemStatements.push(`  - ${statement}`);
              }
            }
            referenceOpinions += `  関連する課題:\n${
              problemStatements.length > 0
                ? `${problemStatements.join("\n")}\n`
                : "    (なし)\n"
            }`;

            // この問いに関連する解決策（関連度 0.8 以上、最大10件を $sample）
            const solutionLinks = await QuestionLink.aggregate([
              {
                $match: {
                  questionId: question._id,
                  linkedItemType: "solution",
                  linkType: "answers_question",
                  relevanceScore: { $gte: 0.8 },
                },
              },
              { $sample: { size: 10 } },
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
                  preserveNullAndEmptyArrays: false,
                },
              },
            ]);

            const solutionStatements = [];
            for (const link of solutionLinks) {
              const solution = link.linkedSolution;
              if (
                solution.themeId &&
                solution.themeId.toString() === themeId
              ) {
                solutionStatements.push(
                  `  - ${solution.statement || "N/A"}`
                );
              }
            }
            referenceOpinions += `  関連する解決策:\n${
              solutionStatements.length > 0
                ? `${solutionStatements.join("\n")}\n`
                : "    (なし)\n"
            }`;

            referenceOpinions += "\n";
          }

          referenceOpinions +=
            "---\nこれらの重要論点や関連意見も踏まえ、ユーザーとの対話を深めてください。\n";
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
    let theme = null;
    try {
      theme = await Theme.findById(themeId);
      if (theme?.customPrompt) {
        systemPrompt = theme.customPrompt;
      } else {
        // --- デフォルト systemPrompt（8.6.1 改訂案 + 8.6.2 チェックリスト反映）---
        systemPrompt = `あなたはテーマ型対話のファシリテーターです。
目的は、数往復の自然な対話でユーザーの考えを引き出すことです（3〜4往復を目安に、厳格な上限にはしないでください）。

この対話には「テーマ」が設定されています。テーマ名（または短い説明）は、このあと【参考情報】ブロックの直前に【テーマ】として示されます。対話は常にこのテーマに関係する範囲で行います。

ただし、ユーザーの発言を無理に遮ったり、話題を強引に戻したりしてはいけません。話が広がった場合は、テーマと関係しそうな接点を見つけて、「その視点はテーマの〇〇ともつながりそうですね」とやわらかく橋をかけてください。

「参考情報」として、他ユーザーの意見から整理された「問題」や「解決策」の論点が与えられます。これは質問テンプレではなく、対話の視点ヒントとして使います。そのまま読み上げたり、機械的に順番に聞いたりしてはいけません。

対話の目標は次の4点をユーザーの言葉から引き出すことです：
・現状の認識（何が起きているか）
・それに対する感情や評価（どう感じているか）
・背景にある経験（どんな経緯があるか）
・条件や主張のこだわり度合い（どこを変えたいか）

ルール：
・毎回まず短く受け止めてから質問する
・質問は1ターン1問（最大2問）
・尋問調にしない
・仮の言い換えや軽い仮説は許可する（断定は禁止）。例：「もしかして〇〇という感覚に近いですか？」は可。「それは〇〇ですね」と決めつけるのは不可。
・解決策はユーザーから出るまで提示しない
・段取りやフェーズの存在を感じさせない
・ユーザーが「特にない」「ここまで」などと示したら、短くねぎらって対話を終える
・最初の1回は、テーマに軽く触れつつ、ユーザーが話したいことを1つ聞く
・1回の返答は、短い受け止め（1〜2文）＋質問（1〜2問）で、全体で4文以内。必要なら受け止めと質問のあいだで改行する
`;
      }
    } catch (error) {
      console.error(`Error fetching theme ${themeId} for prompt:`, error);
      theme = null;
      // フォールバック用の同一プロンプト（テーマ取得失敗時）
      systemPrompt = `あなたはテーマ型対話のファシリテーターです。
目的は、数往復の自然な対話でユーザーの考えを引き出すことです（3〜4往復を目安に、厳格な上限にはしないでください）。

この対話には「テーマ」が設定されています。テーマ名（または短い説明）は、このあと【参考情報】ブロックの直前に【テーマ】として示されます。対話は常にこのテーマに関係する範囲で行います。

ただし、ユーザーの発言を無理に遮ったり、話題を強引に戻したりしてはいけません。話が広がった場合は、テーマと関係しそうな接点を見つけて、「その視点はテーマの〇〇ともつながりそうですね」とやわらかく橋をかけてください。

「参考情報」として、他ユーザーの意見から整理された「問題」や「解決策」の論点が与えられます。これは質問テンプレではなく、対話の視点ヒントとして使います。そのまま読み上げたり、機械的に順番に聞いたりしてはいけません。

対話の目標は次の4点をユーザーの言葉から引き出すことです：
・現状の認識（何が起きているか）
・それに対する感情や評価（どう感じているか）
・背景にある経験（どんな経緯があるか）
・条件や主張のこだわり度合い（どこを変えたいか）

ルール：
・毎回まず短く受け止めてから質問する
・質問は1ターン1問（最大2問）
・尋問調にしない
・仮の言い換えや軽い仮説は許可する（断定は禁止）。例：「もしかして〇〇という感覚に近いですか？」は可。「それは〇〇ですね」と決めつけるのは不可。
・解決策はユーザーから出るまで提示しない
・段取りやフェーズの存在を感じさせない
・ユーザーが「特にない」「ここまで」などと示したら、短くねぎらって対話を終える
・最初の1回は、テーマに軽く触れつつ、ユーザーが話したいことを1つ聞く
・1回の返答は、短い受け止め（1〜2文）＋質問（1〜2問）で、全体で4文以内。必要なら受け止めと質問のあいだで改行する
`;
    }

    llmMessages.push({ role: "system", content: systemPrompt });
    // --- End core system prompt ---

    // Add the reference opinions as a system message（【テーマ】を先頭に置く：8.6.3）
    if (referenceOpinions) {
      const referenceContent =
        theme?.title != null
          ? `【テーマ】${theme.title}\n\n${referenceOpinions}`
          : referenceOpinions;
      llmMessages.push({ role: "system", content: referenceContent });
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
