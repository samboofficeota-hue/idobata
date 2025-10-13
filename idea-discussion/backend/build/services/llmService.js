import dotenv from "dotenv";
import OpenAI from "openai";
// dotenv is loaded in server.js, no need to load it again here.
dotenv.config({ override: true }); // Load environment variables from .env file
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY ||
        process.env.OPENROUTER_API_KEY ||
        "mock-api-key",
});
/**
 * Call an LLM model via OpenAI API
 * @param {Array} messages - Array of message objects with role and content properties
 * @param {boolean} jsonOutput - Whether to request JSON output from the LLM
 * @param {string} model - The model ID to use (defaults to gpt-4o-mini)
 * @returns {string|Object} - Returns parsed JSON object if jsonOutput=true, otherwise string content
 */
async function callLLM(messages, jsonOutput = false, model = "gpt-4o-mini") {
    const options = {
        model: model, // Default to gpt-4o-mini, but allow override
        messages: messages,
    };
    if (jsonOutput) {
        options.response_format = { type: "json_object" };
        // Ensure the last message prompts for JSON output explicitly
        if (messages.length > 0 && messages[messages.length - 1].role === "user") {
            messages[messages.length - 1].content +=
                "\n\nPlease respond ONLY in JSON format.";
        }
    }
    console.log("Calling LLM with options:", JSON.stringify(options, null, 2)); // Log request details
    // Check API key before making request
    if (!process.env.OPENAI_API_KEY && !process.env.OPENROUTER_API_KEY) {
        console.error("No valid API key found. Please set OPENAI_API_KEY or OPENROUTER_API_KEY in your .env file");
        throw new Error("No valid API key found. Please set OPENAI_API_KEY or OPENROUTER_API_KEY in your .env file");
    }
    try {
        const completion = await openai.chat.completions.create(options);
        console.log("LLM Response:", JSON.stringify(completion, null, 2)); // Log full response
        const content = completion.choices[0].message?.content;
        if (!content) {
            console.error("LLM returned empty content.");
            throw new Error("LLM returned empty content.");
        }
        if (jsonOutput) {
            try {
                let jsonString = content;
                // First attempt: Check for ```json ... ``` blocks
                const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                    jsonString = jsonMatch[1];
                    console.log("Found JSON in ```json``` block");
                }
                else {
                    // Second attempt: Check for general ``` ... ``` blocks
                    const codeBlockMatch = content.match(/```\s*([\s\S]*?)\s*```/);
                    if (codeBlockMatch) {
                        jsonString = codeBlockMatch[1];
                        console.log("Found JSON in general ``` code block");
                    }
                }
                // Try to parse the extracted or raw content
                return JSON.parse(jsonString);
            }
            catch (e) {
                console.error("Failed to parse LLM JSON response:", content, e);
                // Return the raw content if JSON parsing fails, maybe it's just text
                // Or throw a specific error if JSON is strictly required
                throw new Error(`LLM did not return valid JSON. Raw response: ${content}`);
            }
        }
        return content;
    }
    catch (error) {
        console.error("Error calling OpenAI:", error);
        // Implement retry logic if needed
        throw error;
    }
}
// Simple test function
async function testLLM(model) {
    console.log("Testing LLM connection...");
    if (!process.env.OPENAI_API_KEY) {
        console.error("OPENAI_API_KEY not found in environment variables. Make sure .env is loaded correctly from the project root.");
        return;
    }
    try {
        const response = await callLLM([{ role: "user", content: "Hello!" }], false, model);
        console.log(`LLM Test Response (${model || "default model"}):`);
        console.log(response);
        return response;
    }
    catch (error) {
        console.error("LLM Test Failed:", error);
        throw error;
    }
}
// List of available models that work well with OpenAI
const RECOMMENDED_MODELS = {
    "gpt-4o-mini": "gpt-4o-mini",
    "gpt-4o": "gpt-4o",
    "gpt-4-turbo": "gpt-4-turbo",
    "gpt-4": "gpt-4",
    "gpt-3.5-turbo": "gpt-3.5-turbo",
};
export { callLLM, testLLM, RECOMMENDED_MODELS };
//# sourceMappingURL=llmService.js.map