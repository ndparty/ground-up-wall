# Code Execution Plan: ground-up-wall

| Field          | Value                                              |
| -------------- | -------------------------------------------------- |
| Document Type  | Code Execution Plan                                |
| Epic Work Item | `WI-03`                                            |
| Tech Spec      | `ground-up-wall/docs/phase01/epic_plan-phase01.md` |
| Version        | 1.0                                                |
| Author         | Developer                                          |

---

> This document is the **single source of truth** for implementation sequencing of WI-03 (Upload
> Flow). Do not duplicate content from the epic plan — reference it via `epic_plan-phase01.md`.

---

## Pre-Conditions

- [ ] WI-01 merged to `main` (Foundation — scaffold, schema, Repository, StorageService,
      RealtimeService, AutoModeratorService, PhotoWallService facade)
- [ ] WI-02 merged to `main` (Auth — login, session, role guards, auth context)
- [ ] Migration from WI-01 has been run (all 4 tables exist)
- [ ] Branch created from `main`: `wi-03-upload`

---

> ⚠️ **Single Source of Truth** — This document is the authoritative sequencing guide for WI-03.

---

## 1. ground-up-wall

### 1.1 Upload Form UI and Route

**Commit message:**
`WI-03: create upload page with photo, message, name, and optional social handle fields`

#### Files Changed

| File                     | Change | Description                                                  |
| ------------------------ | ------ | ------------------------------------------------------------ |
| `routes/upload.tsx`      | New    | Upload page — photo upload form with all fields              |
| `islands/UploadForm.tsx` | New    | Client island — form validation, image preview, live counter |

#### Implementation Details

1. **Create `routes/upload.tsx`:**
   - Simple route that renders the `UploadForm` island
   - Fetches system parameters on server-side: `message_prompt_text`, `message_length_limit`,
     `message_length_unit`
   - Passes these as props to the island

2. **Create `islands/UploadForm.tsx`** with:
   - **Photo input**: file picker accepting `image/jpeg, image/png`, with client-side preview
   - **Message textarea**: shows configurable prompt text as placeholder, live counter underneath
   - **Name input**: required text field
   - **Social handle input**: optional text field
   - **Submit button**: disabled until form is valid AND acknowledgment checkbox is checked
   - **Error display**: inline validation errors per field
   - **Live counter**: displays remaining characters or words based on `message_length_unit`. For
     characters: count Unicode code points. For words: count space-separated tokens. Updates on
     every keystroke.
   - **Image compression**: on file select, compress image client-side using Canvas API (1200px max
     width, 0.8 quality) before upload

3. **Form layout** (following NFR-07: 3 taps or fewer):
   ```
   [Photo Upload Area]  (tap 1: select photo)
   [Message]            (tap 2: type message)
   [Your Name]          (tap 3: enter name)
   [Social Handle]      (optional)
   [Acknowledgment ☐]   (mandatory checkbox)
   [Submit]             (disabled until checkbox checked)
   ```

4. **Upload route is intentionally open to all** (per FR-01). This includes authenticated users with
   any role — Participant, Photo Moderator, Admin, **and Display Wall User**. A `display_wall` user
   navigating to `/upload` will see the form and can submit a photo attributed to whatever name they
   type. This is by design (the display wall account is meant to be a TV account, but the URL isn't
   gated). Document in the upload page footer: _"The upload form is open to everyone. The display
   wall account is for viewing only; you don't need to log in to submit a photo."_ No code-side
   guard is required — the spec is explicit (FR-01, US-01).

#### Unit Tests

| Test File                     | Test Method                         | Verifies                                                     |
| ----------------------------- | ----------------------------------- | ------------------------------------------------------------ |
| `islands/UploadForm_test.tsx` | `testFormRendersAllFields`          | All 4 input fields, live counter, and checkbox render        |
| `islands/UploadForm_test.tsx` | `testSubmitDisabledWithoutCheckbox` | Submit button disabled until acknowledgment checkbox checked |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Upload form renders at `/upload` (and `/` redirects to `/upload`)
- [ ] All form fields render with correct labels and placeholders
- [ ] Image preview shows after file selection

---

### 1.2 Privacy Notice, Acknowledgment Checkbox, and Posting Guidelines Disclaimer

**Commit message:**
`WI-03: add privacy notice with indefinite retention disclosure, mandatory acknowledgment checkbox, and posting guidelines disclaimer`

#### Files Changed

| File                         | Change   | Description                                                     |
| ---------------------------- | -------- | --------------------------------------------------------------- |
| `islands/UploadForm.tsx`     | Modified | Add privacy notice section, acknowledgment checkbox, disclaimer |
| `lib/copy/privacy_notice.ts` | New      | Privacy notice text content (DR-04 warm tone)                   |
| `lib/copy/disclaimers.ts`    | New      | Posting guidelines disclaimer text content                      |

#### Implementation Details

1. **Create `lib/copy/privacy_notice.ts`:**
   ```typescript
   export const PRIVACY_NOTICE =
     `We'll display your name, message, and photo on the photowall during the party!
   Your submission (including your photo and info) will be kept by the organisers after the event so we can share the joy on social media.
   If you share your Instagram handle, we might tag you too!
   Got questions? Just look for any organiser at the party — we're happy to help.`;
   ```

2. **Create `lib/copy/disclaimers.ts`:**
   ```typescript
   export const POSTING_GUIDELINES_DISCLAIMER =
     `Heads up! If your submission doesn't show up on the wall within a reasonable time, it may have been gently redirected because it didn't quite follow our posting guidelines. No worries — feel free to review the guidelines and give it another go! Our friendly moderators may also tweak your message or name to keep things celebration-appropriate.`;
   ```

3. **Modify `islands/UploadForm.tsx` — add privacy notice section** above the form fields:
   - Display the privacy notice text in a visually clear section
   - Use warm, friendly tone per DR-04
   - Below the notice, add the **mandatory acknowledgment checkbox**:
     ```html
     <label>
       <input type="checkbox" checked="{acknowledged}" onChange="{...}" />
       I've read and understood the privacy notice and posting guidelines
     </label>
     ```
   - Submit button is disabled (`disabled={!acknowledged}`)

4. **Add posting guidelines disclaimer** below the submit button and on the success confirmation
   page:
   - Shown both on the form and after successful submission
   - Same warm tone, informs that rejected submissions don't get notifications

#### Unit Tests

| Test File                     | Test Method                  | Verifies                                                |
| ----------------------------- | ---------------------------- | ------------------------------------------------------- |
| `islands/UploadForm_test.tsx` | `testPrivacyNoticeDisplayed` | Privacy notice text is visible on the upload page       |
| `islands/UploadForm_test.tsx` | `testCheckboxEnablesSubmit`  | Submit button becomes enabled after checkbox is checked |
| `islands/UploadForm_test.tsx` | `testDisclaimerDisplayed`    | Posting guidelines disclaimer is visible on the form    |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Privacy notice is displayed with indefinite retention and social media language
- [ ] Acknowledgment checkbox must be checked before submit is enabled
- [ ] Posting guidelines disclaimer visible on form and after submission

---

### 1.3 Message Length Validation (Characters and Words Modes)

**Commit message:**
`WI-03: implement configurable message length validation with live counter for characters and words modes`

#### Files Changed

| File                                    | Change   | Description                                              |
| --------------------------------------- | -------- | -------------------------------------------------------- |
| `islands/UploadForm.tsx`                | Modified | Add live counter logic, validate against limit on submit |
| `lib/validation/message_length.ts`      | New      | Message length validation utilities                      |
| `lib/validation/message_length_test.ts` | New      | Tests for message length validation                      |

#### Implementation Details

1. **Create `lib/validation/message_length.ts`:**
   ```typescript
   export interface MessageLengthConfig {
     limit: number;
     unit: "characters" | "words";
   }

   export function getRemainingLength(message: string, config: MessageLengthConfig): number {
     if (config.unit === "characters") {
       // Count Unicode code points (not UTF-16 code units)
       const charCount = [...message].length;
       return config.limit - charCount;
     } else {
       // Count space-separated tokens
       const wordCount = message.trim() ? message.trim().split(/\s+/).length : 0;
       return config.limit - wordCount;
     }
   }

   export function isMessageValid(message: string, config: MessageLengthConfig): boolean {
     return getRemainingLength(message, config) >= 0;
   }
   ```

2. **Modify `islands/UploadForm.tsx`:**
   - Fetch `message_length_limit` and `message_length_unit` from system parameters on mount (via API
     call)
   - Add live counter display: `{remaining} {unit} remaining`
   - Counter updates on every keystroke, turns red when negative
   - On submit, validate message length before sending to API
   - If exceeded, show error and prevent submission

#### Unit Tests

| Test File                               | Test Method                  | Verifies                                                |
| --------------------------------------- | ---------------------------- | ------------------------------------------------------- |
| `lib/validation/message_length_test.ts` | `testCharacterCountExact`    | Message exactly at character limit passes               |
| `lib/validation/message_length_test.ts` | `testCharacterCountExceeded` | Message exceeding character limit fails                 |
| `lib/validation/message_length_test.ts` | `testCharacterCountUnicode`  | Unicode code points (e.g. emoji, CJK) counted correctly |
| `lib/validation/message_length_test.ts` | `testWordCountExact`         | Message exactly at word limit passes                    |
| `lib/validation/message_length_test.ts` | `testWordCountExceeded`      | Message exceeding word limit fails                      |
| `lib/validation/message_length_test.ts` | `testEmptyMessage`           | Empty message is valid (0 words/0 characters)           |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Live counter shows remaining characters/words on every keystroke
- [ ] Counter turns red when limit is exceeded
- [ ] Submit is blocked when message exceeds limit
- [ ] Unicode characters (emoji, CJK) counted correctly in character mode

---

### 1.4 Submission API Endpoint and Client-Side Image Compression

**Commit message:**
`WI-03: implement POST /api/submissions endpoint with image compression and auto-moderator flagging`

#### Files Changed

| File                                 | Change   | Description                                                       |
| ------------------------------------ | -------- | ----------------------------------------------------------------- |
| `routes/api/submissions/index.ts`    | New      | POST /api/submissions — create new submission                     |
| `islands/UploadForm.tsx`             | Modified | Add client-side image compression, submit to API, handle response |
| `lib/services/photo_wall_service.ts` | Modified | Wire submitSubmission to handle submission flow end-to-end        |

#### Implementation Details

1. **Create `routes/api/submissions/index.ts`:**
   - POST handler — accepts multipart form data
   - Validates: file type (image/jpeg, image/png), file size (max 10MB), message length, name
     required
   - Calls `photoWallService.submitSubmission(data)`
   - Returns 201 with submission ID and status
   - Returns 400 with validation errors on failure

2. **Add client-side image compression to `islands/UploadForm.tsx`:**
   ```typescript
   async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<Blob> {
     const img = await createImageBitmap(file);
     const canvas = document.createElement("canvas");
     const ratio = Math.min(maxWidth / img.width, 1);
     canvas.width = Math.round(img.width * ratio);
     canvas.height = Math.round(img.height * ratio);
     const ctx = canvas.getContext("2d")!;
     ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
     return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", quality));
   }
   ```

3. **Modify `islands/UploadForm.tsx` submit handler:**
   - Compress image client-side before upload
   - Build `FormData` with compressed image, message, name, social handle
   - POST to `/api/submissions`
   - On 200/201: show success page with posting guidelines disclaimer
   - On 400: show validation errors inline

#### Unit Tests

| Test File                              | Test Method                     | Verifies                               |
| -------------------------------------- | ------------------------------- | -------------------------------------- |
| `routes/api/submissions/index_test.ts` | `testSubmitValidSubmission`     | Valid multipart submission returns 201 |
| `routes/api/submissions/index_test.ts` | `testSubmitWithoutPhoto`        | Missing photo returns 400              |
| `routes/api/submissions/index_test.ts` | `testSubmitWithInvalidFileType` | Non-image file returns 400             |
| `routes/api/submissions/index_test.ts` | `testSubmitWithOversizedFile`   | File >10MB returns 400                 |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Valid submission returns 201 with submission ID
- [ ] Invalid file type returns 400 with "Invalid file type"
- [ ] File >10MB returns 400 with "File too large"
- [ ] Image is compressed client-side before upload (verify size reduction)
- [ ] Success page shows confirmation message and posting guidelines disclaimer

---

### 1.5 Auto-Moderator Integration on Submission

**Commit message:**
`WI-03: integrate auto-moderator content flagging into submission flow with audit logging`

#### Files Changed

| File                                 | Change   | Description                                       |
| ------------------------------------ | -------- | ------------------------------------------------- |
| `lib/services/photo_wall_service.ts` | Modified | Add auto-moderator check to submitSubmission flow |
| `routes/api/submissions/index.ts`    | Modified | Return flagged info in submission response        |

#### Implementation Details

1. **Modify `lib/services/photo_wall_service.ts`** `submitSubmission` method to:
   - After image upload and before creating submission record, call
     `autoModeratorService.checkMessage(message, wordList)`
   - Read word list from repository: `repository.getSystemConfig('auto_moderator_word_list')`
   - If word list is empty/null, use the seeded default list (defined in code)
   - Set `is_flagged` and `flagged_words` fields on the submission
   - Audit log: log `submit` action with auto-moderator results

2. **Modify submission response** to include `is_flagged` status:
   ```typescript
   { submission_id: string, status: 'pending', is_flagged: boolean }
   ```

#### Unit Tests

| Test File                                 | Test Method                    | Verifies                                                  |
| ----------------------------------------- | ------------------------------ | --------------------------------------------------------- |
| `lib/services/photo_wall_service_test.ts` | `testSubmitWithFlaggedMessage` | Submission with flagged word returns is_flagged=true      |
| `lib/services/photo_wall_service_test.ts` | `testSubmitWithCleanMessage`   | Submission without flagged words returns is_flagged=false |
| `lib/services/photo_wall_service_test.ts` | `testSubmitWithEmptyWordList`  | Auto-moderator handles empty word list gracefully         |

#### Verification

- [ ] Project compiles without errors
- [ ] All existing tests pass
- [ ] New tests pass
- [ ] Code coverage meets ≥80% threshold for new/modified code
- [ ] Submission with profanity is flagged (is_flagged=true)
- [ ] Submission without profanity is clean (is_flagged=false)
- [ ] Flagged submission has flagged_words populated
- [ ] Audit log entry created for submission

---

## Post-Implementation Checklist

- [ ] All chunks verified — each compiles, passes tests, and meets ≥80% coverage
- [ ] No regressions in existing functionality
- [ ] Post-implementation checks executed and signed off
- [ ] Participant can submit a photo without login (FR-01)
- [ ] Upload form captures photo, message, name, optional social handle (FR-02)
- [ ] Message length validation works for both characters and words modes
- [ ] Privacy notice with indefinite retention is displayed (FR-02a)
- [ ] Mandatory acknowledgment checkbox required before submit (FR-02a)
- [ ] Posting guidelines disclaimer on form and success page (FR-02b)
- [ ] Submitted photos go to moderation queue (FR-03)
- [ ] Success confirmation shown after submission (FR-04)
- [ ] Client-side image compression works
- [ ] Auto-moderator flags submissions with configured word list (FR-09a)
