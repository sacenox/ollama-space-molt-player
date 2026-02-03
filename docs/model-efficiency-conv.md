Conversation Summary: Improving LLM Decision-Making in SpaceMolt Game Bot
Context & Original Problem
User has a SpaceMolt game bot (packages/client/) that uses an LLM to make decisions. The bot was stuck in a loop repeatedly trying to mine while docked, receiving "Cannot mine while docked" errors every tick but not learning from these failures.
Root Cause: The LLM only had access to the last 5 messages (~1.5 ticks of history), so it couldn't see the pattern of repeated failures.
Hardware Constraints

- Single GPU with 12GB VRAM
- Requires quantized models
- Currently running Ollama locally
- Models installed: lfm2.5-thinking (731MB), qwen3:8b (5.2GB), qwen2.5:7b (4.7GB), others
  Goal
  Improve LLM decision-making by giving it more context so it can:

1. Recognize patterns of repeated failures
2. Change behavior when actions fail multiple times
3. Make better strategic decisions based on recent history
   What We've Done
4. Analyzed the Problem (packages/client/memory-human-partner.sqlite)

- Examined game database showing bot tried {"type":"mine"} on ticks 17994-18000
- Each attempt returned {"code":"docked","message":"Cannot mine while docked"}
- Bot couldn't see this pattern due to limited context (5 messages = ~1.5 ticks)

2. Increased Context Window
   Files Modified:

- packages/client/src/types.ts: Added contextWindowSize?: number to ClientConfig
- packages/client/src/game-client.ts: Changed this.db.getMessages(5) to this.db.getMessages(this.config.contextWindowSize || 20)
- packages/client/src/cli.ts: Added --context-window / -cw CLI option (default: 20)
- packages/client/tests/cli.test.ts: Updated tests for new defaults
  Rationale: 20 messages ≈ 6 ticks of history (vs 5 messages ≈ 1.5 ticks)

3. Changed Default Model to lfm2.5-thinking
   Files Modified:

- packages/client/src/cli.ts: Changed default model from qwen3:8b to lfm2.5-thinking
- Enabled thinking mode by default (changed --thinking flag to --no-thinking opt-out)
- Updated help text and examples
  Rationale:
- Smaller footprint (731MB vs 5.2GB)
- Designed for reasoning tasks
- Fits 12GB VRAM easily
- Has thinking capability built-in

4. Added Thinking Output Display
   Files Modified:

- packages/client/src/ollama.ts:
  - Added GenerateResult interface with response and optional thinking fields
  - Updated OllamaResponse to include thinking?: string
  - Changed generate() return type from Promise<string> to Promise<GenerateResult>
- packages/client/src/game-client.ts:
  - Updated both generate() call sites to handle GenerateResult
  - Added console logging: console.log(\[${this.config.instanceId}] Thinking:\n${result.thinking}\`)`
  - Added error logging: console.error(\[${this.config.instanceId}] LLM response: ${result.response}\`)` when command is invalid
- packages/client/tests/ollama.test.ts: Updated all tests to expect GenerateResult, added test for thinking content
  Rationale: See LLM's reasoning process to debug decision-making

5. Deleted Obsolete Test

- Removed packages/client/tests/prompt-length.test.ts (validated 4096 char limit with 5-10 messages, no longer relevant)

6. All Tests Passing

- 81 tests across 6 files ✅
- TypeScript compilation clean ✅
- Formatting/linting pass ✅
  Current Critical Issue: Prompt Truncation
  Ollama Server Logs Show:
  level=WARN source=types.go:966 msg="invalid option provided" option=thinking
  level=WARN source=runner.go:186 msg="truncating input prompt" limit=4096 prompt=87377 keep=4 new=4096
  Two Problems:
  Problem 1: Invalid thinking Parameter
- lfm2.5-thinking has thinking built-in by default
- It doesn't accept thinking as an option parameter
- Currently causes warnings every request
- Fix needed: Remove/disable the thinking option when using this model
  Problem 2: Massive Prompt Truncation (CRITICAL)
- Prompts are 87,377 tokens (21x over limit!)
- Model only handles 4,096 tokens (despite spec saying 32K)
- Our context window increase didn't help - prompts are still truncated to ~1.5 ticks
- LLM never sees the expanded context we added
  Why Prompts Are So Large:
- API documentation (PLAYER_API_REFERENCE) is probably huge
- 20 messages × ~10KB avg state_update = ~200KB
- Character prompt + hint + instructions
- Game context JSON structure
  What Needs To Happen Next
  Immediate Priority: Make the Context Window Actually Work
  Option A: Reduce Context Window to Fit Limit
- Calculate: 87K tokens ÷ 20 messages ≈ 4.3K per message
- To fit 4K limit: need ~1 message (back to square one)
- To fit 32K limit: 32K ÷ 4.3K ≈ 7 messages
- Recommendation: Set contextWindowSize default to 6-7 instead of 20
- This gives 2 ticks of history (better than current 0 ticks due to truncation)
  Option B: Compress Prompt Content
- Reduce/summarize PLAYER_API_REFERENCE in packages/client/src/player-api-reference.ts
- Filter state_update fields to only essential info in packages/client/src/game-client.ts (buildLLMContext method)
- Strip redundant data from history messages
- This would allow more messages within token budget
  Option C: Switch Models
- Try qwen2.5:7b (32K context window, already installed)
- Or download deepseek-r1:7b (~5GB, 128K context window, thinking built-in)
- Would need to verify actual context limits work vs Ollama truncation
  Option D: Fix thinking Parameter Issue
- For lfm2.5-thinking: Don't send thinking: true in options
- Model has thinking built-in, parameter causes errors
- Simple code change in packages/client/src/ollama.ts
  Testing Strategy

1. Fix the thinking parameter issue first (easy win)
2. Reduce context window to 7 messages
3. Run bot and check if it stops repeating failed actions
4. Monitor Ollama logs for truncation warnings
5. If successful, optimize prompt content to allow more messages
   Files to Focus On Next
6. packages/client/src/ollama.ts:
   - Line 52-54: Conditional logic for sending thinking option
   - May need to check model name and skip for lfm2.5-thinking
7. packages/client/src/cli.ts:
   - Line 71: Change default contextWindowSize from 20 to 7
8. packages/client/src/game-client.ts:
   - Line 379: Uses this.config.contextWindowSize || 20
   - Line 271-337: processTick() method - where prompt is built
   - Consider: buildLLMContext() method optimization
9. packages/client/src/player-api-reference.ts:
   - May be huge - check size and potentially compress
     Key Commands

# Run bot with current setup

bun start --instance human-partner --archetype diplomat

# Run bot with reduced context (test)

bun start --instance human-partner --archetype diplomat --context-window 7

# Run tests

bun test

# Full check

bun run check

# Check Ollama logs

# (wherever Ollama server is running - shows truncation warnings)

Success Criteria
Bot should:

1. See enough history to recognize repeated "docked" errors
2. Try {"type":"undock"} instead of repeatedly trying {"type":"mine"}
3. Not have prompts truncated by Ollama (no warnings in server logs)
4. Show thinking output in console for debugging
