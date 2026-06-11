# Code Execution Plan: ground-up-wall

| Field | Value |
|-------|-------|
| Document Type | Code Execution Plan |
| Epic Work Item | `WI-05a` |
| Tech Spec | `ground-up-wall/docs/phase01/epic_plan-phase01.md` |
| Version | 1.0 |
| Author | Developer |

---

> This document is the **single source of truth** for implementation sequencing of WI-05a (Display Wall Core).

---

## Pre-Conditions

- [ ] WI-01 merged to `main` (Foundation — all services, RealtimeService events)
- [ ] WI-02 merged to `main` (Auth — login, session, role guards, auth context)
- [ ] WI-03 merged to `main` (Upload — submissions exist in database)
- [ ] WI-04 merged to `main` (Moderation — approve/reject creates approved submissions)
- [ ] Migration has been run (tables exist, seed data for system_config available)
- [ ] Branch created from `main`: `wi-05a-display-core`

---

> ⚠️ **Single Source of Truth** — This document is the authoritative sequencing guide for WI-05a.

---

## 1. ground-up-wall

### 1.1 Display Wall Route with Auth Gate

**Commit message:** `WI-05a: create display wall route with authentication gate (Display Wall User / Moderator / Admin only)`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `routes/display.tsx` | New | Display wall page — auth-gated route for display wall |
| `routes/api/display/check-access.ts` | New | GET /api/display/check-access — check if current user can view display |
| `routes/api/_middleware.ts` | Modified | Add display wall auth middleware patterns |

#### Implementation Details

  1. **Create `routes/display.tsx`:**
     - Route handler checks authentication via middleware
     - If not authenticated or Participant role: return 403 with message:
       ```
       "Access not allowed. Please refer to the organiser's screen instead."
       ```
     - If Display Wall User / Moderator / Admin: render the DisplayComponent island
     - Full-screen layout (no header, no nav — just the train)
     - **Fullscreen handling (do NOT auto-call `requestFullscreen()` on mount)** — the Fullscreen API requires a user gesture and will throw `NotAllowedError` if invoked from script on page load. Instead:
       - Render a "Click to go fullscreen" overlay button on first load (one-time, dismissable)
       - The button's click handler calls `document.documentElement.requestFullscreen()`
       - Persist a `display_wall_fullscreen_dismissed` flag in `localStorage` so the overlay only shows once per browser
       - Document in SETUP.md that the organiser can also press **F11** on the TV keyboard after first load to toggle fullscreen
       - For dev/QA, the same F11 path works without the overlay

2. **Create `routes/api/display/check-access.ts`:**
   - GET endpoint that checks session and role
   - Returns `{ allowed: boolean, role: string }`

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `routes/display_test.ts` | `testUnauthenticatedGets403` | Unauthenticated user receives 403 with correct message |
| `routes/display_test.ts` | `testDisplayWallUserAllowed` | Display Wall User can access the route |
| `routes/display_test.ts` | `testModeratorAllowed` | Moderator can access the route |
| `routes/display_test.ts` | `testAdminAllowed` | Admin can access the route |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Unauthenticated access to `/display` returns 403 with organiser message
- [ ] Display Wall User can access `/display`
- [ ] Moderator and Admin can access `/display`
- [ ] Page renders in full-screen layout

---

### 1.2 SMRT MRT Train Rendering (Static)

**Commit message:** `WI-05a: implement SMRT MRT train visual rendering with CSS animation and cabin layout`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `static/train.css` | New | Train animation CSS — SMRT red/white styling, cabin layout, scroll animation |
| `islands/TrainDisplay.tsx` | New | Main train display island — orchestrates rendering and animation |
| `islands/TrainCabin.tsx` | New | Individual cabin component — photo, message, name display |

#### Implementation Details

1. **Create `static/train.css`:**
   - SMRT MRT train visual style (red/white Singapore metro aesthetic per DR-01)
   - Train container: horizontal scroll container, overflow hidden
   - Cabin cards: fixed width/height suitable for TV viewing, large fonts (name ≥24px, message ≥18px per NFR-08)
   - Photo takes ≥60% of cabin area
   - Active cabin: centered in viewport with slight scale emphasis
   - Transition: CSS `transform: translateX()` with `transition: transform 0.8s ease-in-out` for cabin-to-cabin scroll
   - Right-to-left movement direction
   - National Day branding accents (subtle red/white theme, not overpowering per DR-02/DR-03)
   - Empty state: branded waiting screen with "Submissions coming soon!" message

2. **Create `islands/TrainCabin.tsx`:**
   - Props: `submission: Submission`, `isActive: boolean`, `index: number`
   - Renders: photo (fills 60%+ of cabin), message text, submitter name, social handle if present
   - Active cabin gets slight scale/border emphasis

3. **Create `islands/TrainDisplay.tsx`:**
   - Maintains state: `submissions[]`, `currentIndex`, `isPlaying`, `dwellTime`
   - On mount: fetch approved submissions and render initial train
   - Render cabins in a horizontal flex container
   - `transitionToNextCabin()`: increment `currentIndex` (loop to 0 at end), apply CSS transform to scroll train container so the target cabin is centered
   - Use `requestAnimationFrame` for smooth timing
   - Apply dwell time from system_config (default 15s, range 3-60s)

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `islands/TrainDisplay_test.tsx` | `testRendersSubmittedCabins` | Approved submissions render as cabins |
| `islands/TrainDisplay_test.tsx` | `testEmptyStateShowsWaiting` | No submissions shows branded waiting screen |
| `islands/TrainDisplay_test.tsx` | `testTransitionToNextCabin` | Transition advances to next cabin index |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Train renders with SMRT MRT red/white visual style
- [ ] Each cabin shows photo ≥60% of area, message, name
- [ ] Fonts are large enough to read from across the room
- [ ] Empty state shows branded National Day waiting screen
- [ ] Animation targets 60fps (verify with DevTools FPS meter)

---

### 1.3 Circular Doubly-Linked Chain Data Structure

**Commit message:** `WI-05a: implement circular doubly-linked chain data structure for cabin management`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `lib/train/chain.ts` | New | Circular doubly-linked chain implementation with init, lookup, rebuild |
| `lib/train/chain_test.ts` | New | Property-based tests for chain correctness |

#### Implementation Details

1. **Create `lib/train/chain.ts`:**
   ```typescript
   export interface TrainCabinNode {
     submission: Submission;
     index: number;           // 0-based logical index
     next: TrainCabinNode | null;
     prev: TrainCabinNode | null;
   }

   export interface TrainChain {
     nodes: TrainCabinNode[];       // Flat array for O(1) index lookups
     head: TrainCabinNode | null;   // First cabin (index 0)
     current: TrainCabinNode | null; // Currently focused cabin
   }

   export function initTrain(submissions: Submission[]): TrainChain {
     // Build flat array from submissions
     // Link each node → next (last links back to head for circular)
     // Set head to first node, current to head
   }

   export function getNodeByCabinNumber(chain: TrainChain, cabinNumber: number): TrainCabinNode | null {
     // Convert 1-based input to 0-based index
     // Clamp to [0, chain.nodes.length - 1]
     // O(1) lookup via chain.nodes[index]
   }

   export function rebuildChain(chain: TrainChain, submissions: Submission[]): void {
     // Rebuild the entire chain when submissions change
     // Preserve current cabin position if possible
   }

   export function transitionToNext(chain: TrainChain): TrainCabinNode | null {
     // Advance current to current.next
     // If at end (head), loop back to head
   }
   ```

2. **Property-based test invariants:**
   - After any sequence of operations, chain is circular (last.next === head, head.prev === last)
   - All nodes are reachable from head by traversing `next` N times (where N = length)
   - Original ordering is preserved after rebuild
   - `getNodeByCabinNumber(1)` returns head (index 0)
   - `getNodeByCabinNumber(N)` returns last node (index N-1)
   - Out-of-range values are clamped correctly

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `lib/train/chain_test.ts` | `testInitCreatesCircularChain` | Chain is circular after init |
| `lib/train/chain_test.ts` | `testGetNodeByCabinNumber` | Lookup returns correct node |
| `lib/train/chain_test.ts` | `testGetNodeClampsOutOfRange` | Out-of-range values clamp to first/last |
| `lib/train/chain_test.ts` | `testRebuildPreservesOrder` | Rebuild preserves chronological order |
| `lib/train/chain_test.ts` | `testEmptyChain` | Empty submissions create empty chain |
| `lib/train/chain_test.ts` | `testSingleCabinChain` | Single cabin chain: next and prev point to itself |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Chain is always circular after any operation
- [ ] All nodes reachable from head
- [ ] Property-based tests pass with random sequences (run multiple iterations)

---

### 1.4 Real-Time Subscriptions and Dynamic Updates

**Commit message:** `WI-05a: integrate real-time subscriptions for approved, edited, and deleted submissions`

#### Files Changed

| File | Change | Description |
|------|--------|-------------|
| `islands/TrainDisplay.tsx` | Modified | Add RealtimeService subscriptions for live updates |
| `routes/api/display/submissions.ts` | New | GET /api/display/submissions — fetch all approved submissions |
| `lib/train/chain.ts` | Modified | Add `addSubmission`, `updateSubmission`, `removeSubmission` methods |

#### Implementation Details

1. **Create `routes/api/display/submissions.ts`:**
   - GET endpoint, requires display_wall/moderator/admin role
   - Returns all approved submissions ordered chronologically
   - Includes photo URL, message, name, social handle, edit metadata

2. **Modify `lib/train/chain.ts` — add dynamic methods:**
   ```typescript
   export function addSubmission(chain: TrainChain, submission: Submission): void {
     // Append new node to end of chain (before head)
     // Update links to maintain circularity
   }

   export function updateSubmission(chain: TrainChain, submission: Submission): void {
     // Find node by submission.id
     // Update its submission data in place
     // Cabin content updates immediately via Preact reactivity
   }

   export function removeSubmission(chain: TrainChain, submissionId: string): void {
     // Find node by submission.id
     // Re-link prev.next = node.next, next.prev = node.prev
     // Remove from flat array
     // If removing current, advance to next
   }
   ```

3. **Modify `islands/TrainDisplay.tsx` — add subscriptions:**
   ```typescript
   // On mount:
   const realtime = /* get RealtimeService */;
   
   // Subscribe to new approvals
   realtime.onSubmissionApproved((submission) => {
     addSubmission(chain, submission);
     // If paused, submission is appended but not shown until resume
   });
   
   // Subscribe to edits
   realtime.onSubmissionEdited((submission) => {
     updateSubmission(chain, submission);
   });
   
   // Subscribe to deletions
   realtime.subscribe('submission_deleted', (payload) => {
     removeSubmission(chain, payload.id);
   });
   ```

#### Unit Tests

| Test File | Test Method | Verifies |
|-----------|-------------|----------|
| `lib/train/chain_test.ts` | `testAddSubmission` | Adding submission appends to end of chain |
| `lib/train/chain_test.ts` | `testUpdateSubmission` | Updating submission changes content in place |
| `lib/train/chain_test.ts` | `testRemoveSubmission` | Removing submission re-links chain correctly |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] New approved submission appears at end of train within 30 seconds (NFR-04)
- [ ] Edited submission updates cabin content in real-time
- [ ] Deleted submission removed from train in real-time
- [ ] Train continues animating smoothly during updates

---

## Post-Implementation Checklist

- [ ] All chunks verified — each compiles, passes tests, and meets ≥80% coverage
- [ ] No regressions in existing functionality
- [ ] Post-implementation checks executed and signed off
- [ ] Display wall renders SMRT MRT train with SG National Day theme (DR-01, DR-02, DR-03)
- [ ] Auth gate correctly blocks unauthenticated users and Participants (FR-24b)
- [ ] Display Wall User, Moderator, and Admin can all view the display wall (FR-24b)
- [ ] Cabins display photo, message, and name with legible fonts (NFR-08)
- [ ] Animation runs at or near 60fps (NFR-03)
- [ ] Empty state shows branded waiting screen (FR-23)
- [ ] Real-time updates add/edit/remove cabins without manual refresh (FR-22)
- [ ] New approvals appear within 30 seconds (NFR-04)
- [ ] Chain data structure passes property-based tests