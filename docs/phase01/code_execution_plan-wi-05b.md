# Code Execution Plan: ground-up-wall

| Field | Value |
|-------|-------|
| Document Type | Code Execution Plan |
| Epic Work Item | `WI-05b` |
| Tech Spec | `ground-up-wall/docs/phase01/epic_plan-phase01.md` |
| Version | 1.0 |
| Author | Developer |

---

> This document is the **single source of truth** for implementation sequencing of WI-05b (Train Controls).

---

## Pre-Conditions

- [ ] WI-05a merged to `main` (Display Wall Core — train rendering, chain data structure, real-time subscriptions, auth gate)
- [ ] Branch created from `main`: `wi-05b-train-controls`

---

> ⚠️ **Single Source of Truth** — This document is the authoritative sequencing guide for WI-05b.

---

## 1. ground-up-wall

### 1.1 Pause/Play Controls

**Commit message:** `WI-05b: implement pause/play controls for train animation`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `islands/TrainControls.tsx` | New | Train control island — pause/play/jump buttons |
| `islands/TrainDisplay.tsx` | Modified | Wire pause/play state, controls visibility by role |
| `static/train.css` | Modified | Add control panel styles (overlay on display wall) |

#### Implementation Details

1. **Create `islands/TrainControls.tsx`:**
   - Props: `isPlaying`, `onPause`, `onPlay`, `trainLength`, `roles`
   - Shows pause/play toggle button
   - Shows jump-to-cabin input (implemented in next chunk)
   - **Visibility**: only rendered when `role === 'moderator' || role === 'admin'` (hidden from Display Wall User)
   - Styled as a semi-transparent overlay at the bottom of the display wall

2. **Modify `islands/TrainDisplay.tsx`:**
   - Add state: `isPlaying: boolean` (default `true`)
   - Modify transition loop: when `isPlaying` is `true`, use `setTimeout` with dwell time to call `transitionToNextCabin()`; when `isPlaying` is `false`, clear the timeout
   - `pauseTrain()`: set `isPlaying = false`, clear any pending transition timeout, publish `train_paused` event via RealtimeService API endpoint
   - `resumeTrain()`: set `isPlaying = true`, start transition loop from current cabin, publish `train_resumed` event
   - Subscribe to `train_paused` / `train_resumed` events from RealtimeService to sync across browser tabs

3. **Publish train commands** via API endpoint (for cross-tab sync):
   - POST `/api/display/train-command` with `{ type: 'pause' | 'play' | 'jump', cabinNumber?: number }`
   - Handler calls `photoWallService.publishTrainCommand(command)`

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `islands/TrainControls_test.tsx` | `testShowsControlsForModerator` | Controls visible for moderator role |
| `islands/TrainControls_test.tsx` | `testHidesControlsForDisplayWallUser` | Controls hidden for display wall user |
| `islands/TrainDisplay_test.tsx` | `testPauseStopsTimer` | Pausing clears the transition timeout |
| `islands/TrainDisplay_test.tsx` | `testResumeRestartsTimer` | Resuming restarts transition cycle |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Pause button freezes train on current cabin (FR-24a)
- [ ] Resume button continues from same cabin
- [ ] Controls visible only for Moderator/Admin, hidden for Display Wall User
- [ ] Pause/play syncs across browser tabs via RealtimeService

---

### 1.2 Jump-to-Cabin with Chain-Relinking Algorithm

**Commit message:** `WI-05b: implement jump-to-cabin using chain-relinking algorithm for smooth single-scroll animation`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `lib/train/chain.ts` | Modified | Add `jumpToCabin` function implementing chain-relinking algorithm |
| `lib/train/chain_test.ts` | Modified | Add property-based tests for jump-to-cabin chain-relinking |
| `islands/TrainControls.tsx` | Modified | Add jump-to-cabin input field and button |
| `islands/TrainDisplay.tsx` | Modified | Wire jumpToCabin to trigger chain-relinking + single transition |

#### Implementation Details

1. **Add `jumpToCabin` to `lib/train/chain.ts`:**
   ```typescript
   export function jumpToCabin(chain: TrainChain, cabinNumber: number): void {
     // Clamp cabinNumber to valid range [1, chain.nodes.length]
     const clampedCabin = Math.max(1, Math.min(cabinNumber, chain.nodes.length));
     
     // If train is empty, do nothing
     if (chain.nodes.length === 0) return;
     
     // Get current and target nodes (0-based index)
     const currentIndex = chain.current?.index ?? 0;
     const targetIndex = clampedCabin - 1;
     
     // If already on the target cabin, do nothing
     if (currentIndex === targetIndex) return;
     
     // Get nodes
     const currentNode = chain.nodes[currentIndex];
     const targetNode = chain.nodes[targetIndex];
     
     // Save original pointers for restoration
     const currentOriginalNext = currentNode.next!;
     const targetOriginalPrev = targetNode.prev!;
     
     // If target is already the next cabin, no relinking needed — just transition
     if (currentNode.next === targetNode) {
       transitionToNext(chain);
       return;
     }
     
     // Step 1: Temporarily re-link
     currentNode.next = targetNode;
     targetNode.prev = currentNode;
     
     // Step 2: Execute single transition
     transitionToNext(chain);  // This advances current to targetNode
     
     // Step 3: Restore original chain
     currentNode.next = currentOriginalNext;
     currentOriginalNext.prev = currentNode;
     targetNode.prev = targetOriginalPrev;
     targetOriginalPrev.next = targetNode;
     
     // Ensure current is now pointing to the target
     chain.current = targetNode;
   }
   ```

2. **Modify `islands/TrainControls.tsx`**: Add jump input:
   - Number input field with label "Jump to cabin #"
   - Button to execute jump
   - Display current cabin number / total cabins (e.g. "Cabin 3 of 15")

3. **Modify `islands/TrainDisplay.tsx`**: Wire jump command:
   - When jump is triggered, call `jumpToCabin(chain, cabinNumber)`
   - Execute single `transitionToNextCabin()` animation
   - Publish `train_jump` event via RealtimeService for cross-tab sync

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `lib/train/chain_test.ts` | `testJumpToCabinForward` | Jump to higher cabin number works |
| `lib/train/chain_test.ts` | `testJumpToCabinBackward` | Jump to lower cabin number works |
| `lib/train/chain_test.ts` | `testJumpToCurrentCabin` | Jump to same cabin does nothing |
| `lib/train/chain_test.ts` | `testJumpToNextCabin` | Jump to next cabin uses simple transition |
| `lib/train/chain_test.ts` | `testJumpOutOfRangeClamps` | Out-of-range values clamp to first/last |
| `lib/train/chain_test.ts` | `testJumpEmptyTrain` | Jump on empty train does nothing |
| `lib/train/chain_test.ts` | `testJumpChainIntegrity` | After jump + restore, chain is still circular and ordered |
| `lib/train/chain_test.ts` | `testMultipleJumpsChainIntegrity` | Multiple consecutive jumps preserve chain integrity |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Jump to cabin number smoothly scrolls to target cabin in one transition
- [ ] Jump to out-of-range number clamps to last cabin (FR-24a)
- [ ] After jump, chain is still circular and all nodes reachable
- [ ] Property-based tests pass: multiple random jump sequences preserve chain integrity
- [ ] Jump command syncs across browser tabs

---

### 1.3 New Submissions During Pause

**Commit message:** `WI-05b: handle new submissions appended during pause state (not shown until resume)`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `islands/TrainDisplay.tsx` | Modified | New submissions during pause append to chain but don't show until resume |

#### Implementation Details

1. **Modify `islands/TrainDisplay.tsx`** subscription handler:
   - When `isPlaying === false` and a new submission arrives:
     - Append to chain via `addSubmission(chain, submission)`
     - DO NOT advance current cabin
     - DO NOT trigger transition
   - When `isPlaying` becomes `true` (resume):
     - Resume normal transition cycle from current cabin
     - New cabins appear in sequence as train advances

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `lib/train/chain_test.ts` | `testAddSubmissionDuringPause` | Adding during pause appends but doesn't advance current |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] New approved submissions during pause are appended to train but not displayed (FR-24a)
- [ ] On resume, the new cabin appears in sequence when train advances

---

## Post-Implementation Checklist

- [ ] All chunks verified — each compiles, passes tests, and meets ≥80% coverage
- [ ] No regressions in existing functionality
- [ ] Post-implementation checks executed and signed off
- [ ] Pause freezes train, resume continues from current cabin (FR-24a)
- [ ] Controls visible only for Moderator/Admin (FR-24a)
- [ ] Display Wall User cannot see controls
- [ ] Jump-to-cabin works with single smooth scroll (FR-24a)
- [ ] Chain-relinking algorithm passes property-based tests
- [ ] New submissions during pause appended but hidden until resume (FR-24a)
- [ ] Pause/play/jump commands sync across browser tabs via RealtimeService