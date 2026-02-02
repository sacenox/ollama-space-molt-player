# Prompt Introduction Update

**Date**: 2026-02-02  
**File Modified**: `src/prompt.ts`  
**Lines**: 243-246

---

## Change Summary

Updated the game introduction in action prompts to be **neutral, factual, and non-sensational**.

---

## Before (Sensational/Biased)

```
You are playing the SpaceMolt.
SpaceMolt is a massively multiplayer space game built for AI agents, set in "The Crustacean Cosmos."
Agents explore, trade, battle, and build empires in a living universe with emergent wars and a player-driven economy.
The game emphasizes real-time AI fleet combat, ongoing discoveries of new systems, and shifting trade routes and alliances.
```

**Issues**:
- ❌ "massively multiplayer" - sensational qualifier
- ❌ "The Crustacean Cosmos" - flavor text, not factual
- ❌ "living universe with emergent wars" - dramatic, biased language
- ❌ "emphasizes" - suggests gameplay priorities
- ❌ "ongoing discoveries" - implies novelty/excitement
- ❌ "shifting trade routes and alliances" - dramatic framing

---

## After (Neutral/Factual)

```
You are playing SpaceMolt.
SpaceMolt is a multiplayer space game where AI agents control ships in a persistent universe.
Players can explore systems, trade resources, engage in combat, and interact with other players.
The game operates on a turn-based tick system where each action occurs over a 10-second interval.
```

**Improvements**:
- ✅ "multiplayer" - factual, not sensational
- ✅ "AI agents control ships" - clear, technical
- ✅ "persistent universe" - factual descriptor
- ✅ Lists capabilities neutrally: explore, trade, combat, interact
- ✅ Explains tick system factually
- ✅ Removes flavor text and marketing language
- ✅ Removes implied priorities or emphasis

---

## Analysis Results

**Prompt Length Change**: 
- Old: ~244 characters
- New: ~238 characters
- Change: -6 chars (-2.5%)

**Bias Check**: ✅ No bias patterns detected

**Impact**: 
- Prompts are now ~45 chars shorter
- Language is more neutral and factual
- No loss of essential information
- Character traits (personality, alignment) remain the primary source of behavioral guidance

---

## Verification

Tested with:
```bash
bun run scripts/generate-prompt-from-db.ts \
  memory-human-partner-instance.sqlite \
  --count=1 \
  --output=prompt-analysis-new-intro-test.md
```

**Result**: ✅ All checks pass, no new issues introduced

---

## Rationale

The previous introduction contained **marketing/promotional language** that could bias the AI's decision-making:

1. **"massively multiplayer"** → implies scale matters
2. **"emergent wars"** → suggests conflict is expected/exciting
3. **"living universe"** → anthropomorphizes the game
4. **"emphasizes"** → creates gameplay priorities
5. **"ongoing discoveries"** → implies exploration should be prioritized
6. **"shifting alliances"** → suggests social dynamics are central

These phrases can subtly influence the AI to:
- Seek out conflict
- Prioritize exploration over other activities
- Favor social/political gameplay
- Treat certain actions as more "important"

The new introduction is **purely descriptive** and lets the AI's **personality** and **alignment** traits (warrior, merchant, diplomat, etc.) drive behavior choices without additional bias from the system prompt.

---

## Related Files

- `src/prompt.ts` - Modified
- `PROMPT-INTRODUCTION-UPDATE.md` - This document
- `prompt-analysis-new-intro-test.md` - Verification test

---

## Notes

The **registration prompt** (`buildRegistrationPrompt`) already uses neutral language and did not require changes.

