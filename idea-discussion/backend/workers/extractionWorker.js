import ChatThread from "../models/ChatThread.js"; // For chat source
import ImportedItem from "../models/ImportedItem.js"; // For import source
import Problem from "../models/Problem.js";
import Solution from "../models/Solution.js";
import { callLLM } from "../services/llmService.js";
import { emitNewExtraction } from "../services/socketService.js"; // Import socket service
import { linkItemToQuestions } from "./linkingWorker.js"; // Assume this function exists and works

// Helper function to build the prompt based on source type
function buildExtractionPrompt(sourceType, data) {
  let prompt = "";

  if (sourceType === "chat") {
    const { messages, existingProblems, existingSolutions } = data;
    // Prepare conversation history string
    // Find the latest user message index
    const latestUserIndex = [...messages]
      .reverse()
      .findIndex((msg) => msg.role === "user");
    const latestUserPosition =
      latestUserIndex >= 0 ? messages.length - 1 - latestUserIndex : -1;

    // Get the latest user message content
    const latestUserMessage =
      latestUserPosition >= 0
        ? messages[latestUserPosition].content
        : "No user message found";

    // Format messages with special marking for the latest user message
    const history = messages
      .map((msg, index) => {
        const isLatestUser = index === latestUserPosition;
        return `${msg.role}${isLatestUser ? " [LATEST USER MESSAGE]" : ""}: ${msg.content}`;
      })
      .join("\n");

    // Prepare existing data summaries
    const existingProblemSummary =
      existingProblems.length > 0
        ? existingProblems
            .map((p) => `- ID: ${p._id}, Statement: ${p.statement}`)
            .join("\n")
        : "None";
    const existingSolutionSummary =
      existingSolutions.length > 0
        ? existingSolutions
            .map((s) => `- ID: ${s._id}, Statement: ${s.statement}`)
            .join("\n")
        : "None";

    // Construct the prompt for chat
    prompt = `
Conversation History:
---
${history}
---

Existing Extracted Problems (for context, focus on user turns below for *new* problems):
---
${existingProblemSummary}
---

Existing Extracted Solutions (for context, focus on user turns below for *new* solutions):
---
${existingSolutionSummary}
---

Latest User Message:
---
${latestUserMessage}
---

Instructions:
Analyze the **latest user message** (marked with [LATEST USER MESSAGE]) in the Conversation History above.
Identify and extract the following, ensuring the output is in **Japanese**:
1.  **New Problems:** If a user message introduces a new problem (an unmet need or challenge), describe it. Provide:
    *   statement (課題の記述, Japanese)
2.  **New Solutions:** If a user message proposes a specific solution or approach, describe it. Provide:
    *   statement (解決策の記述, Japanese)
3.  **Updates to Existing Items:** If a user message refines or clarifies an *existing* problem or solution (listed above), provide its ID and the updated Japanese statement.

課題（problem）の書き方:
- 主語を明確にする。「誰が / 何が、どういう状況で、どう困っているか」が読み取れる形で書く。
- 現状と、望ましい状態とのギャップがわかるようにする。
- 発言に含まれていない事実・数値・背景・出所を補わない。書かれている範囲だけで書く。
- 解決策を先取りしない（解決策は solution 側に分ける）。
- 話者の感情や価値判断は、事実と区別できる形であれば残してよい（例：「〜を負担に感じている」）。消す必要はない。

解決策（solution）の書き方:
- 「何を、どうするのか」が具体的にわかる形で書く。
- それによって何が変わるか（狙い・効果）が発言から読み取れる場合は含める。読み取れない場合は推測で補わない。
- 「〜を改善する」のような言い換えだけで終わらせない。

課題・解決策に共通のルール:
- **発言の立場（賛成 / 反対 / 条件付き / 留保）を必ず保持する。**「〜には賛成だが〜は懸念している」のような条件付き・両論の立場を、片側だけに単純化しない。
- 長さの目安：40〜120文字。ただし立場・条件・留保を落とすことになる場合は、この目安を超えてよい。**字数より意図の保持を優先する。**

Rules:
- Focus *only* on the contributions from the 'user' role marked with [LATEST USER MESSAGE] in the conversation history for identifying *new* problems or solutions.
- The message marked with [LATEST USER MESSAGE] is the most recent user message that you should analyze.
- Ensure all generated statements are in **Japanese**.
- 既存の課題・解決策（上記リスト）と実質的に同じ内容は additions に入れない。表現を補強・修正する場合のみ updates に入れ、その ID を指定する。
- 1回の抽出で additions は最大5件。
- 発言が短くても、課題または解決策として明確に読み取れる内容が1つでもあれば抽出する。読み取れる内容がない場合（挨拶・相槌・質問のみなど）は空の配列を返す。推測で補完しない。

Output Format: Respond ONLY in JSON format with the following structure:
{
  "additions": [
    { "type": "problem", "statement": "課題の説明..." },
    { "type": "solution", "statement": "具体的な解決策..." }
  ],
  "updates": [
    { "id": "existing_problem_id", "type": "problem", "statement": "更新された課題の説明..." },
    { "id": "existing_solution_id", "type": "solution", "statement": "更新された解決策..." }
  ]
}
`;
  } else if (
    sourceType === "tweet" ||
    sourceType === "other_import" ||
    sourceType !== "chat"
  ) {
    const { content } = data;
    // Construct the prompt for single text import
    prompt = `
Input Text:
---
${content}
---

Instructions:
Analyze the Input Text above.
Identify and extract the following, ensuring the output is in **Japanese**:
1.  **Problems:** If the text describes a problem (an unmet need or challenge), describe it. Provide:
    *   statement (課題の記述, Japanese)
2.  **Solutions:** If the text proposes a specific solution or approach, describe it. Provide:
    *   statement (解決策の記述, Japanese)

課題（problem）の書き方:
- 主語を明確にする。「誰が / 何が、どういう状況で、どう困っているか」が読み取れる形で書く。
- 現状と、望ましい状態とのギャップがわかるようにする。
- 入力テキストに含まれていない事実・数値・背景・出所（発言者の肩書き、収集された場など）を補わない。書かれている範囲だけで書く。
- 解決策を先取りしない（解決策は solution 側に分ける）。
- 書き手の感情や価値判断は、事実と区別できる形であれば残してよい（例：「〜を負担に感じている」）。消す必要はない。

解決策（solution）の書き方:
- 「何を、どうするのか」が具体的にわかる形で書く。
- それによって何が変わるか（狙い・効果）がテキストから読み取れる場合は含める。読み取れない場合は推測で補わない。
- 「〜を改善する」のような言い換えだけで終わらせない。

課題・解決策に共通のルール:
- **書き手の立場（賛成 / 反対 / 条件付き / 留保）を必ず保持する。**「〜には賛成だが〜は懸念している」のような条件付き・両論の立場を、片側だけに単純化しない。
- 長さの目安：40〜120文字。ただし立場・条件・留保を落とすことになる場合は、この目安を超えてよい。**字数より意図の保持を優先する。**

Rules:
- Extract only problems and solutions explicitly mentioned or strongly implied in the text.
- Ensure all generated statements are in **Japanese**.
- 同じ内容を重複して additions に入れない。
- 1回の抽出で additions は最大5件。
- テキストが短くても、課題または解決策として明確に読み取れる内容が1つでもあれば抽出する。読み取れる内容がない場合は空の配列を返す。推測で補完しない。

Output Format: Respond ONLY in JSON format with the following structure:
{
  "additions": [
    { "type": "problem", "statement": "課題の説明..." },
    { "type": "solution", "statement": "具体的な解決策..." }
  ]
}
`;
  }

  // Return messages array for LLM
  return [{ role: "user", content: prompt }];
}

// Helper to save a new problem/solution and trigger linking
async function saveAndLinkItem(
  itemData,
  sourceOriginId,
  sourceType,
  sourceMetadata,
  themeId
) {
  let savedItem;
  if (itemData.type === "problem") {
    const newProblem = new Problem({
      statement: itemData.statement,
      sourceOriginId: sourceOriginId,
      sourceType: sourceType,
      sourceMetadata: sourceMetadata || {},
      version: 1,
      themeId: themeId,
    });
    savedItem = await newProblem.save();
    console.log(
      `[ExtractionWorker] Added Problem: ${savedItem._id} from ${sourceType} ${sourceOriginId} for theme ${themeId}`
    );
  } else if (itemData.type === "solution") {
    const newSolution = new Solution({
      statement: itemData.statement,
      sourceOriginId: sourceOriginId,
      sourceType: sourceType,
      sourceMetadata: sourceMetadata || {},
      version: 1,
      themeId: themeId,
    });
    savedItem = await newSolution.save();
    console.log(
      `[ExtractionWorker] Added Solution: ${savedItem._id} from ${sourceType} ${sourceOriginId} for theme ${themeId}`
    );
  }

  if (savedItem) {
    // Trigger linking asynchronously
    setTimeout(
      () => linkItemToQuestions(savedItem._id.toString(), itemData.type),
      0
    );
    return savedItem;
  }
  return null;
}

// Main processing function called by the job queue worker
async function processExtraction(job) {
  const { sourceType, sourceOriginId, content, metadata, themeId } = job.data; // Assuming job data structure
  console.log(
    `[ExtractionWorker] Starting extraction for ${sourceType}: ${sourceOriginId}`
  );
  // Transaction removed as it requires a replica set/mongos

  try {
    let llmResponse;
    const addedProblemIds = [];
    const addedSolutionIds = [];

    if (sourceType === "chat") {
      // --- Chat Processing Logic ---
      const thread = await ChatThread.findById(sourceOriginId);
      if (!thread) {
        console.error(
          `[ExtractionWorker] ChatThread not found: ${sourceOriginId}`
        );
        return; // Or throw error for queue retry
      }

      const existingProblemIds = thread.extractedProblemIds || [];
      const existingSolutionIds = thread.extractedSolutionIds || [];

      const [existingProblems, existingSolutions] = await Promise.all([
        Problem.find({ _id: { $in: existingProblemIds } }),
        Solution.find({ _id: { $in: existingSolutionIds } }),
      ]);

      // 2. Build prompt and call LLM for chat
      const extractionPromptMessages = buildExtractionPrompt("chat", {
        messages: thread.messages,
        existingProblems,
        existingSolutions,
      });
      // 複数件の課題・解決策をまとめて返しうるため、既定の2048では不足しうる
      llmResponse = await callLLM(extractionPromptMessages, true, undefined, {
        max_tokens: 4000,
      });

      if (
        !llmResponse ||
        typeof llmResponse !== "object" ||
        (!llmResponse.additions && !llmResponse.updates)
      ) {
        console.warn(
          `[ExtractionWorker] LLM did not return valid JSON or expected structure for chat ${sourceOriginId}. Response:`,
          llmResponse
        );
        return; // Or throw error
      }

      const additions = llmResponse.additions || [];
      const updates = llmResponse.updates || [];

      // 3. Process additions for chat
      const totalAdditions = additions.length;
      console.log(
        `[ExtractionWorker] Processing ${totalAdditions} new items for chat ${sourceOriginId}`
      );

      for (let i = 0; i < additions.length; i++) {
        const item = additions[i];
        console.log(
          `[ExtractionWorker] Processing item ${i + 1}/${totalAdditions} (${item.type}) for chat ${sourceOriginId}`
        );
        const savedItem = await saveAndLinkItem(
          item,
          sourceOriginId,
          "chat",
          {},
          thread.themeId
        ); // Pass themeId from thread
        if (savedItem) {
          if (item.type === "problem") {
            addedProblemIds.push(savedItem._id);
            emitNewExtraction(
              thread.themeId,
              sourceOriginId,
              "problem",
              savedItem
            );
          }
          if (item.type === "solution") {
            addedSolutionIds.push(savedItem._id);
            emitNewExtraction(
              thread.themeId,
              sourceOriginId,
              "solution",
              savedItem
            );
          }
        }
      }

      // 4. Process updates for chat (existing logic adapted)
      const totalUpdates = updates.length;
      console.log(
        `[ExtractionWorker] Processing ${totalUpdates} updates for chat ${sourceOriginId}`
      );

      for (let i = 0; i < updates.length; i++) {
        const item = updates[i];
        console.log(
          `[ExtractionWorker] Processing update ${i + 1}/${totalUpdates} (${item.type}) for chat ${sourceOriginId}`
        );
        if (!item.id) {
          console.warn(
            `[ExtractionWorker] Invalid update item received from LLM for chat ${sourceOriginId}:`,
            item
          );
          continue;
        }
        const updateData = { ...item };
        updateData.id = undefined;
        updateData.type = undefined;
        updateData.version = undefined; // Let $inc handle version

        let Model;
        if (item.type === "problem") Model = Problem;
        else if (item.type === "solution") Model = Solution;
        else continue;

        const existingItem = await Model.findById(item.id);
        if (!existingItem) {
          console.warn(
            `[ExtractionWorker] ${item.type} ${item.id} not found for update (chat ${sourceOriginId}).`
          );
          continue;
        }

        const result = await Model.findOneAndUpdate(
          { _id: item.id, version: existingItem.version },
          { $set: updateData, $inc: { version: 1 } },
          { new: true }
        );
        if (result) {
          console.log(
            `[ExtractionWorker] Updated ${item.type}: ${item.id} to version ${result.version} (chat ${sourceOriginId})`
          );
          setTimeout(
            () => linkItemToQuestions(item.id.toString(), item.type),
            0
          ); // Trigger linking for updates too
        } else {
          console.warn(
            `[ExtractionWorker] Failed to update ${item.type} ${item.id} (chat ${sourceOriginId}). Version mismatch or not found.`
          );
        }
      }

      // 5. Update ChatThread with new IDs (if any)
      if (addedProblemIds.length > 0 || addedSolutionIds.length > 0) {
        await ChatThread.updateOne(
          { _id: sourceOriginId },
          {
            $addToSet: {
              extractedProblemIds: { $each: addedProblemIds },
              extractedSolutionIds: { $each: addedSolutionIds },
            },
          }
        );
        console.log(
          `[ExtractionWorker] Updated chat thread ${sourceOriginId} with new extraction IDs.`
        );
      }
    } else if (
      sourceType === "tweet" ||
      sourceType === "other_import" ||
      sourceType !== "chat"
    ) {
      // --- Import Processing Logic ---
      const importItem = await ImportedItem.findById(sourceOriginId);
      if (!importItem) {
        console.error(
          `[ExtractionWorker] ImportedItem not found: ${sourceOriginId}`
        );
        return; // Or throw error
      }
      if (importItem.status !== "pending") {
        console.warn(
          `[ExtractionWorker] ImportedItem ${sourceOriginId} is not pending, skipping. Status: ${importItem.status}`
        );
        return;
      }

      // Mark as processing
      importItem.status = "processing";
      await importItem.save();

      // 2. Build prompt and call LLM for import
      const extractionPromptMessages = buildExtractionPrompt(sourceType, {
        content: importItem.content,
      });
      // 複数件の課題・解決策をまとめて返しうるため、既定の2048では不足しうる
      llmResponse = await callLLM(extractionPromptMessages, true, undefined, {
        max_tokens: 4000,
      });

      if (
        !llmResponse ||
        typeof llmResponse !== "object" ||
        !llmResponse.additions
      ) {
        console.warn(
          `[ExtractionWorker] LLM did not return valid JSON or expected structure for import ${sourceOriginId}. Response:`,
          llmResponse
        );
        importItem.status = "failed";
        importItem.errorMessage = "LLM response invalid";
        await importItem.save();
        return; // Or throw error
      }

      const additions = llmResponse.additions || [];

      // 3. Process additions for import
      const totalAdditions = additions.length;
      console.log(
        `[ExtractionWorker] Processing ${totalAdditions} new items for ${sourceType} ${sourceOriginId}`
      );

      for (let i = 0; i < additions.length; i++) {
        const item = additions[i];
        console.log(
          `[ExtractionWorker] Processing item ${i + 1}/${totalAdditions} (${item.type}) for ${sourceType} ${sourceOriginId}`
        );
        // Use the metadata from the job/importItem and pass themeId
        const savedItem = await saveAndLinkItem(
          item,
          sourceOriginId,
          sourceType,
          importItem.metadata,
          importItem.themeId
        );
        if (savedItem) {
          if (item.type === "problem") {
            addedProblemIds.push(savedItem._id);
            emitNewExtraction(
              importItem.themeId,
              sourceOriginId,
              "problem",
              savedItem
            );
          }
          if (item.type === "solution") {
            addedSolutionIds.push(savedItem._id);
            emitNewExtraction(
              importItem.themeId,
              sourceOriginId,
              "solution",
              savedItem
            );
          }
        }
      }

      // 4. Update ImportedItem status and IDs
      importItem.status = "completed";
      importItem.extractedProblemIds = addedProblemIds;
      importItem.extractedSolutionIds = addedSolutionIds;
      importItem.processedAt = new Date();
      importItem.errorMessage = undefined; // Clear previous error if any
      await importItem.save();
      console.log(
        `[ExtractionWorker] Updated imported item ${sourceOriginId} with status 'completed' and extraction IDs.`
      );
    }

    // Common success log
    console.log(
      `[ExtractionWorker] Successfully processed extraction for ${sourceType}: ${sourceOriginId}`
    );
  } catch (error) {
    console.error(
      `[ExtractionWorker] Error processing extraction for ${sourceType} ${sourceOriginId}:`,
      error
    );

    // Attempt to mark ImportedItem as failed if applicable
    if (
      sourceType === "tweet" ||
      sourceType === "other_import" ||
      sourceType !== "chat"
    ) {
      try {
        await ImportedItem.updateOne(
          { _id: sourceOriginId, status: "processing" }, // Only update if still processing
          {
            $set: {
              status: "failed",
              errorMessage: error.message || "Unknown error",
            },
          }
        );
      } catch (updateError) {
        console.error(
          `[ExtractionWorker] Failed to mark ImportedItem ${sourceOriginId} as failed:`,
          updateError
        );
      }
    }
    // Rethrow the error if the job queue supports retries
    // throw error;
  }
}

// Export the main processing function
export { processExtraction };

/*
// --- Old Chat-Specific Logic (kept for reference during refactoring, remove later) ---

async function processExtraction_OLD(threadId) {
    console.log(`[ExtractionWorker] Starting extraction for thread: ${threadId}`);
    // Transaction removed as it requires a replica set/mongos

    try {
        // 1. Fetch thread and existing extractions within the transaction
        const thread = await ChatThread.findById(threadId); // Removed .session(session)
        if (!thread) {
            console.error(`[ExtractionWorker] Thread not found: ${threadId}`);
            // Removed transaction abort/end
            return;
        }

        const existingProblemIds = thread.extractedProblemIds || [];
        const existingSolutionIds = thread.extractedSolutionIds || [];

        const [existingProblems, existingSolutions] = await Promise.all([
            Problem.find({ '_id': { $in: existingProblemIds } }), // Removed .session(session)
            Solution.find({ '_id': { $in: existingSolutionIds } }) // Removed .session(session)
        ]);

        // 2. Build prompt and call LLM
        const extractionPromptMessages = buildExtractionPrompt_OLD(thread.messages, existingProblems, existingSolutions);
        // 複数件の課題・解決策をまとめて返しうるため、既定の2048では不足しうる
        const llmResponse = await callLLM(
          extractionPromptMessages,
          true,
          undefined,
          { max_tokens: 4000 }
        );

        if (!llmResponse || typeof llmResponse !== 'object' || (!llmResponse.additions && !llmResponse.updates)) {
            console.warn(`[ExtractionWorker] LLM did not return valid JSON or expected structure for thread ${threadId}. Response:`, llmResponse);
            // Removed transaction abort/end
            return;
        }


        const additions = llmResponse.additions || [];
        const updates = llmResponse.updates || [];
        const addedProblemIds = [];
        const addedSolutionIds = [];

        // 3. Process additions
        for (const item of additions) {
             const savedItem = await saveAndLinkItem(item, threadId, 'chat', {}); // Use helper
             if (savedItem) {
                 if (item.type === 'problem') addedProblemIds.push(savedItem._id);
                 if (item.type === 'solution') addedSolutionIds.push(savedItem._id);
             }
        }

        // 4. Process updates
         for (const item of updates) {
             if (!item.id) {
                console.warn(`[ExtractionWorker] Invalid update item received from LLM for thread ${threadId}:`, item);
                continue;
            }
            const updateData = { ...item };
            delete updateData.id;
            delete updateData.type;
            delete updateData.version; // Let $inc handle version

            let Model, existingItem;
            if (item.type === 'problem') Model = Problem;
            else if (item.type === 'solution') Model = Solution;
            else continue;

            existingItem = await Model.findById(item.id);
            if (!existingItem) {
                 console.warn(`[ExtractionWorker] ${item.type} ${item.id} not found for update (thread ${threadId}).`);
                 continue;
            }

            const result = await Model.findOneAndUpdate(
                { _id: item.id, version: existingItem.version },
                { $set: updateData, $inc: { version: 1 } },
                { new: true }
            );
            if (result) {
                console.log(`[ExtractionWorker] Updated ${item.type}: ${item.id} to version ${result.version} (thread ${threadId})`);
                setTimeout(() => linkItemToQuestions(item.id.toString(), item.type), 0); // Trigger linking for updates too
            } else {
                console.warn(`[ExtractionWorker] Failed to update ${item.type} ${item.id} (thread ${threadId}). Version mismatch or not found.`);
            }
        }

        // 5. Update ChatThread with new IDs (if any)
        if (addedProblemIds.length > 0 || addedSolutionIds.length > 0) {
            await ChatThread.updateOne(
                { _id: threadId },
                {
                    $addToSet: {
                        extractedProblemIds: { $each: addedProblemIds },
                        extractedSolutionIds: { $each: addedSolutionIds },
                    },
                }
            );
            console.log(`[ExtractionWorker] Updated thread ${threadId} with new extraction IDs.`);
        }

        // Transaction removed
        console.log(`[ExtractionWorker] Successfully processed extraction for thread: ${threadId}`);

    } catch (error) {
        console.error(`[ExtractionWorker] Error processing extraction for thread ${threadId}:`, error);
        // Transaction removed
        // Consider adding retry logic or moving to a dead-letter queue here
    }
    // Linking is triggered within the loop now
}
*/
