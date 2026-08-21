import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../..", ".env") });

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error(
    "Error: MONGODB_URI is not defined. Please check .env file or docker-compose.yml file."
  );
  process.exit(1);
}

import ImportedItem from "../models/ImportedItem.js";
import Problem from "../models/Problem.js";
import Solution from "../models/Solution.js";
import Theme from "../models/Theme.js";

// --- 設定 ---
// 前半 PROPOSAL_COUNT 件を「提案」= Solution、残りを「懸念・慎重論」= Problem として扱う。
// 北見市アンケートMDファイルは 100件(提案) + 50件(懸念) = 150件の構成であることを前提にしている。
const PROPOSAL_COUNT = 100;
const SOURCE_TYPE_PROPOSAL = "kitami_survey_2024_proposal";
const SOURCE_TYPE_CONCERN = "kitami_survey_2024_concern";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const positional = args.filter((a) => !a.startsWith("--"));
const mdFilePath = positional[0];
const themeId = positional[1];

if (!mdFilePath || !themeId) {
  console.error(
    "Usage: node importKitamiOpinions.js <mdFilePath> <themeId> [--dry-run] [--force]"
  );
  process.exit(1);
}

function parseOpinions(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split(/\r?\n/);
  const items = [];

  for (const line of lines) {
    const match = line.match(/^\s*\d+[.、]\s*(.+?)\s*$/);
    if (!match) continue;
    // Markdown の行末強制改行(全角/半角スペース)を除去
    const statement = match[1].replace(/[ 　]+$/, "").trim();
    if (statement) items.push(statement);
  }

  return items;
}

async function main() {
  const opinions = parseOpinions(mdFilePath);

  console.log(`Parsed ${opinions.length} opinions from ${mdFilePath}`);
  if (opinions.length !== 150) {
    console.warn(
      `Warning: expected 150 opinions but found ${opinions.length}. Check PROPOSAL_COUNT / file format before proceeding.`
    );
  }

  const proposals = opinions.slice(0, PROPOSAL_COUNT);
  const concerns = opinions.slice(PROPOSAL_COUNT);

  console.log(`  -> proposals (Solution): ${proposals.length}`);
  console.log(`  -> concerns (Problem):   ${concerns.length}`);
  console.log("");
  console.log("Sample proposal:", proposals[0]);
  console.log("Sample concern: ", concerns[0]);

  if (dryRun) {
    console.log("\n[dry-run] No DB connection made, no data written.");
    return;
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected successfully.");

  const theme = await Theme.findById(themeId);
  if (!theme) {
    console.error(`Error: Theme ${themeId} not found.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Target theme: "${theme.title}" (${theme._id})`);

  const existingCount = await ImportedItem.countDocuments({
    themeId: theme._id,
    sourceType: { $in: [SOURCE_TYPE_PROPOSAL, SOURCE_TYPE_CONCERN] },
  });
  if (existingCount > 0 && !force) {
    console.error(
      `Error: ${existingCount} items with this sourceType already exist for this theme. ` +
        "Re-running would create duplicates. Pass --force to proceed anyway."
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  let createdProblems = 0;
  let createdSolutions = 0;

  async function importBatch(statements, sourceType, kind) {
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      const importedItem = await ImportedItem.create({
        sourceType,
        content: statement,
        metadata: { index: i },
        status: "completed",
        themeId: theme._id,
        processedAt: new Date(),
      });

      const commonFields = {
        statement,
        sourceOriginId: importedItem._id,
        sourceType,
        originalSnippets: [statement],
        sourceMetadata: {},
        version: 1,
        themeId: theme._id,
        embeddingGenerated: false,
      };

      if (kind === "problem") {
        const problem = await Problem.create(commonFields);
        importedItem.extractedProblemIds = [problem._id];
        createdProblems++;
      } else {
        const solution = await Solution.create(commonFields);
        importedItem.extractedSolutionIds = [solution._id];
        createdSolutions++;
      }

      await importedItem.save();
    }
  }

  console.log("\nImporting proposals as Solutions...");
  await importBatch(proposals, SOURCE_TYPE_PROPOSAL, "solution");

  console.log("Importing concerns as Problems...");
  await importBatch(concerns, SOURCE_TYPE_CONCERN, "problem");

  console.log(
    `\nDone. Created ${createdSolutions} Solutions and ${createdProblems} Problems for theme ${theme._id}.`
  );
  console.log(
    "Next steps: in the admin UI, run 'embeddings' generation for this theme, " +
      "then use the '論点を生成' button on the theme edit page to generate SharpQuestions."
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
