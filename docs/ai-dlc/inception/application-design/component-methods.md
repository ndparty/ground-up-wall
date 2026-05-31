# Component Methods — ground-up-wall (Updated for Update 02)

## Method Signatures Reference

This document provides detailed method signatures for all components. Business rules are noted at a high level; detailed logic will be defined in Functional Design (CONSTRUCTION phase).

---

## UploadComponent Methods

### `submitPhoto(photo: File, message: string, name: string, socialHandle?: string): Promise<SubmissionResult>`

**Purpose**: Main entry point for photo submission

**Parameters**:
- `photo`: Image file (validated: JPEG/PNG, max 10MB)
- `message`: Short message (validated against configurable max length in characters or words)
- `name`: Submitter's name (required)
- `socialHandle`: Optional social media handle

**Returns**: `SubmissionResult` with submission ID and status

**Business Rules**:
- Image must be compressed client-side before upload
- Form validation must pass before submission
- Privacy notice must be visible before submission (FR-02a updated, Update 02)
- Mandatory acknowledgment checkbox must be checked before submit is enabled (FR-02a, Update 02)
- Submission enters "pending" status
- Message is checked by AutoModeratorService

---

### `validateForm(data: UploadData): ValidationResult`

**Purpose**: Validate upload form data

**Parameters**:
- `data`: UploadData object with photo, message, name, socialHandle

**Returns**: `ValidationResult` with isValid flag and error messages

**Validation Rules**:
- Photo: valid image file, under size limit
- Message: validated against configurable max length (default 50 characters); unit (characters or words) determined by system parameter
- Name: non-empty string
- Social handle: optional, valid format if provided
- Acknowledgment checkbox: must be checked

---

### `compressImage(file: File, maxWidth: number, quality: number): Promise<Blob>`

**Purpose**: Client-side image compression

**Parameters**:
- `file`: Original image file
- `maxWidth`: Maximum width in pixels (default: 1200)
- `quality`: JPEG quality 0-1 (default: 0.8)

**Returns**: Compressed image as Blob

**Business Rules**:
- Light compression to maintain screen quality
- Preserve aspect ratio
- Convert to JPEG if not already

---

### `getPromptText(): Promise<string>` (Update 01)

**Purpose**: Load configurable prompt text from system parameters

**Returns**: Prompt text string (default: "What does National Day mean to you?")

**Business Rules**:
- Fetches from system parameters via PhotoWallService
- Falls back to default if not configured

---

### `showPrivacyNotice(): void` (Update 01, revised Update 02)

**Purpose**: Display data privacy notice before submission

**Business Rules**:
- Informs participant that name, message, photo, and optional social handle will be displayed on photowall during event
- States that submission data will be retained indefinitely for organiser social media use
- States that if an Instagram handle is provided, content may be posted on social media with tagging
- Includes reference for contacting organiser with questions
- Uses warm tone per DR-04

---

### `getMessageLimitConfig(): Promise<{limit: number, unit: 'characters' | 'words'}>` (Update 02)

**Purpose**: Load configurable message length limit and unit from system parameters

**Returns**: Object with `limit` (default: 50) and `unit` (default: `'characters'`)

**Business Rules**:
- Fetches from system parameters via PhotoWallService
- Falls back to defaults if not configured
- Used by validateForm and the live counter display

---

## DisplayComponent Methods

### `loadApprovedSubmissions(): Promise<Submission[]>`

**Purpose**: Fetch approved submissions for display

**Returns**: Array of approved submissions ordered chronologically (oldest first)

**Business Rules**:
- Only approved submissions
- Ordered by approval timestamp (ascending)
- Include photo URL, message, name, social handle

---

### `subscribeToUpdates(callback: (submission: Submission) => void): UnsubscribeFn`

**Purpose**: Subscribe to real-time updates for new approvals, edits, deletions

**Parameters**:
- `callback`: Function called when submission changes

**Returns**: Unsubscribe function

**Business Rules**:
- Triggered when submission status changes to "approved"
- Also triggered on `submission_edited` and `submission_deleted` events (Update 01)
- Automatically add/update/remove from train animation
- Handle reconnection gracefully

---

### `renderTrain(submissions: Submission[]): void`

**Purpose**: Render the SMRT train animation

**Parameters**:
- `submissions`: Array of approved submissions

**Business Rules**:
- One cabin per submission
- Train scrolls right to left
- Focus on one cabin at a time (configurable dwell time)
- Smooth transition animation
- Respects current dwell time from system parameters (Update 01)

---

### `transitionToNextCabin(): void`

**Purpose**: Animate transition to next cabin

**Business Rules**:
- Configurable display time per cabin (default ~15s, via system parameters)
- Smooth scroll animation
- Loop back to first cabin when reaching end
- Maintain 60fps performance

---

### `pauseTrain(): void` (Update 01)

**Purpose**: Pause the train animation on the current cabin

**Business Rules**:
- Freeze on current cabin
- Publish `train_paused` event via RealtimeService for other tabs
- Visible only to logged-in Moderators/Admins
- New submissions still appended but not shown until play resumes

---

### `resumeTrain(): void` (Update 01)

**Purpose**: Resume the train animation from current cabin

**Business Rules**:
- Resume normal transition timing
- Publish `train_resumed` event via RealtimeService for other tabs
- Visible only to logged-in Moderators/Admins

---

### `initTrain(submissions: Submission[]): void` (New — Implementation Detail)

**Purpose**: Initialise the train as a circular doubly-linked chain of cabins

**Parameters**:
- `submissions`: Array of approved submissions in chronological order

**Internal State** (not exposed as interface):
```typescript
interface TrainCabinNode {
  submission: Submission
  index: number           // 0-based logical index
  next: TrainCabinNode | null
  prev: TrainCabinNode | null
}
let currentCabin: TrainCabinNode | null
let trainChain: TrainCabinNode[]  // Flat array for O(1) index lookups
```

**Business Rules**:
- Build a flat array `trainChain` from the submissions (for O(1) cabin-number lookups)
- Link each node → next node in order (last links back to first as circular chain)
- Set `currentCabin` to the first cabin (index 0)
- This structure is rebuilt whenever the submissions array changes (new approval, deletion, edit)

---

### `getNodeByCabinNumber(cabinNumber: number): TrainCabinNode | null` (New — Implementation Detail)

**Purpose**: Look up a cabin node by its 1-based cabin number using the flat array

**Parameters**:
- `cabinNumber`: 1-based cabin number (clamped to [1, trainChain.length])

**Returns**: TrainCabinNode at the clamped index or null if train is empty

**Business Rules**:
- Convert 1-based input to 0-based index: `index = Math.max(0, Math.min(cabinNumber - 1, trainChain.length - 1))`
- O(1) lookup via `trainChain[index]`

---

### `getCurrentCabinIndex(): number` (New — Implementation Detail)

**Purpose**: Get the 0-based index of the currently displayed cabin

**Returns**: Index within `trainChain`, or -1 if train is empty

---

### `jumpToCabin(cabinNumber: number): void` (Update 01 — Revised Implementation)

**Purpose**: Jump to a specific cabin by number (1-based) using chain-relinking to ensure a single smooth scroll

**Parameters**:
- `cabinNumber`: Target cabin index (1-based, clamped to train length)

**Implementation — Chain Relinking Algorithm**:

The jump is achieved by temporarily re-linking the cabin chain so that the target cabin becomes the immediate next cabin of the current cabin. This ensures only a single `transitionToNextCabin()` scroll is needed, maintaining smooth 60fps animation.

```
Before jump (current = C, target = T):
  ... → [C] → [C+1] → ... → [T-1] → [T] → [T+1] → ...

Step 1 — Temporarily re-link:
  currentCabin.next = targetNode         // C → T (skip everything between)
  targetNode.prev = currentCabin         // T → C (circular consistency)

Step 2 — Execute single transition:
  transitionToNextCabin()                // Smooth scroll from C to T (one cabin move)

Step 3 — Restore original chain:
  currentCabin.next = originalNext       // Restore C's original next
  targetNode.prev = originalPrev         // Restore T's original previous
  setCurrentCabin(targetNode)            // Mark T as the new current cabin
```

**Business Rules**:
- If `cabinNumber` refers to the currently displayed cabin, do nothing
- If `cabinNumber` equals the next cabin in sequence, no relinking needed — just call `transitionToNextCabin()` normally
- Clamp `cabinNumber` to [1, trainChain.length] — values beyond the length clamp to the last cabin
- If train is empty (no approved submissions), do nothing
- Only the `next` and `prev` pointers of `currentCabin` and `targetNode` are modified — all other chain pointers remain intact
- After restoration, the circular chain is unchanged from its original state
- Publish `train_jump` event via RealtimeService for other tabs (contains `{ currentSubmissions: ... }` for full state sync)
- Visible only to logged-in Moderators/Admins
- The chain structure is entirely in-memory on the client side; no server state is modified
---

### `checkAuthAccess(): Promise<{allowed: boolean, role: string}>` (Update 01, revised Update 02)

**Purpose**: Check if the current user can view the display wall (authentication required)

**Returns**: Object with `allowed` boolean and `role` string

**Business Rules**:
- Only Display Wall Users, Photo Moderators, and Admins are allowed
- Unauthenticated users and Participants receive 403 with "Access not allowed. Please refer to the organiser's screen instead."
- Display Wall Users see the train animation only (no controls)
- Moderators/Admins see the train animation plus pause/play/jump controls

---

### `handleDisplayOverride(command: DisplayOverrideCommand): void` (Update 02)

**Purpose**: Respond to display override commands from mod/admin panel

**Parameters**:
- `command`: DisplayOverrideCommand with `type` ('blank' | 'placeholder' | 'resume') and optional `imageUrl`

**Business Rules**:
- `blank`: Render solid black screen, hide train animation
- `placeholder`: Render the specified image (or system default placeholder), hide train animation
- `resume`: Return to train animation from current position
- Commands received via RealtimeService subscription
- On initial load, check persisted override state from database

---

### `subscribeToDisplayOverride(callback: (command: DisplayOverrideCommand) => void): UnsubscribeFn` (Update 02)

**Purpose**: Subscribe to display override commands broadcast from mod/admin panel

**Parameters**:
- `callback`: Function called when a display override command is received

**Returns**: Unsubscribe function

**Business Rules**:
- Listens to `display_blank`, `display_placeholder`, `display_resume` events via RealtimeService
- All connected display wall sessions receive commands simultaneously

---

## ModerationComponent Methods

### `login(username: string, password: string): Promise<AuthResult>`

**Purpose**: Authenticate Photo Moderator or Admin

**Parameters**:
- `username`: Moderator/Admin username
- `password`: User password

**Returns**: `AuthResult` with user info and session token

**Business Rules**:
- Validate credentials against database
- Check if account is disabled (Update 01 — FR-15a)
- Set session with appropriate role
- Redirect to moderation panel on success

---

### `loadPendingSubmissions(): Promise<Submission[]>`

**Purpose**: Load moderation queue

**Returns**: Array of pending submissions

**Business Rules**:
- Only submissions with "pending" status
- Ordered by submission timestamp (oldest first)
- Include full submission details for review
- Include flagged word indicators if auto-moderator flagged (Update 01)

---

### `approveSubmission(id: string): Promise<void>`

**Purpose**: Approve a submission for display

**Parameters**:
- `id`: Submission ID

**Business Rules**:
- Change status to "approved"
- Set approval timestamp and moderator ID
- Log action in audit log (NFR-22, Update 01)
- Trigger real-time update to display wall
- Add to approved submissions rotation

---

### `rejectSubmission(id: string, reason?: string): Promise<void>`

**Purpose**: Reject a submission

**Parameters**:
- `id`: Submission ID
- `reason`: Optional rejection reason (for audit)

**Business Rules**:
- Change status to "rejected"
- Optionally store rejection reason
- Log action in audit log (NFR-22, Update 01)
- Remove from moderation queue
- No notification sent to submitter

---

### `editSubmission(id: string, data: SubmissionEditData): Promise<Submission>` (Update 01)

**Purpose**: Edit submission content (message, name, social handle)

**Parameters**:
- `id`: Submission ID
- `data`: Updated fields (message, name, social_handle)

**Returns**: Updated Submission with edit metadata

**Business Rules**:
- Can edit pending or approved submissions
- Original values preserved in audit log
- Edited submissions display updated content on wall without re-approval
- Moderation panel shows edited indicator and who made the edit
- Sets `edited_by`, `edited_at`, increments `edit_count`

---

### `deleteApprovedSubmission(id: string): Promise<void>`

**Purpose**: Remove an approved submission from the wall

**Parameters**:
- `id`: Submission ID

**Business Rules**:
- Can only delete approved submissions
- Remove from display rotation immediately
- Log action in audit log (NFR-22, Update 01)
- Trigger real-time update to display wall
- Show confirmation dialog before deletion

---

### `subscribeToNewSubmissions(callback: (submission: Submission) => void): UnsubscribeFn`

**Purpose**: Subscribe to new pending submissions

**Parameters**:
- `callback`: Function called when new submission arrives

**Returns**: Unsubscribe function

**Business Rules**:
- Triggered when new submission is created
- Update moderation queue in real-time
- Notify moderator of pending review

---

### `getFlaggedWords(message: string): string[]` (Update 01)

**Purpose**: Determine which words in a message are flagged by auto-moderator

**Parameters**:
- `message`: Submission message text

**Returns**: Array of flagged words (for UI highlighting)

**Business Rules**:
- Reads word list from system parameters (ships with seeded PG-13 default)
- Returns matching words for visual highlighting in UI

---

### `commandDisplayOverride(type: 'blank' | 'placeholder' | 'resume', image?: File): Promise<void>` (Update 02)

**Purpose**: Command connected display wall sessions to blank, show placeholder, or resume

**Parameters**:
- `type`: Override type — `'blank'`, `'placeholder'`, or `'resume'`
- `image`: Optional per-action override image (for placeholder); if omitted, the system default placeholder is used

**Business Rules**:
- Available to Photo Moderators and Admins from the moderation panel
- Broadcasts command via RealtimeService to all connected display wall sessions
- Override state persisted in database for new sessions
- Action logged in audit log (NFR-22)
- Case-insensitive matching, Unicode support, char substitution

---

## AdminComponent Methods

### `login(username: string, password: string): Promise<AuthResult>`

**Purpose**: Authenticate Admin user

**Parameters**:
- `username`: Admin username
- `password`: Admin password

**Returns**: `AuthResult` with admin user info and session token

**Business Rules**:
- Validate admin credentials
- Check if account is disabled (Update 01)
- Set session with admin role
- Redirect to admin panel on success

---

### `listModerators(): Promise<Moderator[]>`

**Purpose**: List all Photo Moderator accounts

**Returns**: Array of moderator user objects with active/disabled status

**Business Rules**:
- Only accessible by Admin
- Include username, creation date, active/disabled status (FR-15c, Update 01)
- Exclude sensitive data (passwords)

---

### `createModerator(username: string, initialPassword: string): Promise<void>`

**Purpose**: Create new Photo Moderator account

**Parameters**:
- `username`: New moderator username
- `initialPassword`: Initial password

**Business Rules**:
- Only accessible by Admin
- Username must be unique
- Password must meet complexity requirements
- Log action in audit log (NFR-22, Update 01)

---

### `resetModeratorPassword(moderatorId: string, newPassword: string): Promise<void>`

**Purpose**: Reset a moderator's password

**Parameters**:
- `moderatorId`: Moderator user ID
- `newPassword`: New password

**Business Rules**:
- Only accessible by Admin
- Log action in audit log (NFR-22, Update 01)

---

### `disableModerator(moderatorId: string): Promise<void>` (Update 01)

**Purpose**: Disable a moderator account (prevent login without deleting)

**Parameters**:
- `moderatorId`: Moderator user ID

**Business Rules**:
- Only accessible by Admin
- Set `disabled` flag on user record
- Preserve all audit history associated with this moderator
- Log action in audit log (NFR-22)
- Moderator cannot log in while disabled

---

### `enableModerator(moderatorId: string): Promise<void>` (Update 01)

**Purpose**: Re-enable a disabled moderator account

**Parameters**:
- `moderatorId`: Moderator user ID

**Business Rules**:
- Only accessible by Admin
- Clear `disabled` flag on user record
- Log action in audit log (NFR-22)
- Moderator can log in again

---

### `deleteModerator(moderatorId: string): Promise<void>` (Update 01)

**Purpose**: Permanently delete a moderator account

**Parameters**:
- `moderatorId`: Moderator user ID

**Business Rules**:
- Only accessible by Admin
- Show confirmation dialog before deletion
- Audit log entries retain the moderator ID even after deletion
- Log deletion in audit log (NFR-22)

---

### `getSystemParameters(): Promise<SystemConfig[]>` (Update 01)

**Purpose**: Get all configurable system parameters

**Returns**: Array of SystemConfig objects

**Business Rules**:
- Only accessible by Admin
- Returns current value, default value, last updated info
- Parameters: train_dwell_time, message_prompt_text, message_length_limit, message_length_unit, auto_moderator_word_list, default_placeholder_image

---

### `updateSystemParameter(key: string, value: string): Promise<void>` (Update 01)

**Purpose**: Update a system parameter

**Parameters**:
- `key`: Parameter key (e.g. 'train_dwell_time')
- `value`: New value (validated against constraints)

**Business Rules**:
- Only accessible by Admin
- Persist to database immediately
- Broadcast change via RealtimeService for live effect
- Log old and new values in audit log
- Validate value constraints (e.g. dwell time 3-60s)

---

### `resetSystemParameterToDefault(key: string): Promise<void>` (Update 01)

**Purpose**: Reset a system parameter to its default value

**Parameters**:
- `key`: Parameter key

**Business Rules**:
- Only accessible by Admin
- Restore `default_value` from system_config table
- Log change in audit log

---

### `getAuditLog(filters: AuditFilter): Promise<AuditEntry[]>` (Update 01)

**Purpose**: View audit log entries with filtering

**Parameters**:
- `filters`: Filter criteria (moderator, action_type, date_range, target_type)

**Returns**: Array of matching AuditEntry objects

**Business Rules**:
- Only accessible by Admin
- Read-only view — no modification or deletion of entries
- Filterable by moderator, action type, date range, target type

---

### `listDisplayWallUsers(): Promise<DisplayWallUser[]>` (Update 02)

**Purpose**: List all Display Wall User accounts

**Returns**: Array of Display Wall User objects with active/disabled status

**Business Rules**:
- Only accessible by Admin
- Include username, creation date, active/disabled status
- Exclude sensitive data (passwords)

---

### `createDisplayWallUser(username: string, initialPassword: string): Promise<void>` (Update 02)

**Purpose**: Create new Display Wall User account for TV display

**Parameters**:
- `username`: New Display Wall User username
- `initialPassword`: Initial password

**Business Rules**:
- Only accessible by Admin
- Username must be unique across all user types
- Log action in audit log (NFR-22)

---

### `disableDisplayWallUser(userId: string): Promise<void>` (Update 02)

**Purpose**: Disable a Display Wall User account

**Parameters**:
- `userId`: Display Wall User ID

**Business Rules**:
- Only accessible by Admin
- Set `disabled` flag; user can no longer log in
- Log action in audit log (NFR-22)

---

### `deleteDisplayWallUser(userId: string): Promise<void>` (Update 02)

**Purpose**: Permanently delete a Display Wall User account

**Parameters**:
- `userId`: Display Wall User ID

**Business Rules**:
- Only accessible by Admin
- Show confirmation dialog before deletion
- Audit log entries retain the user ID
- Log deletion in audit log (NFR-22)

---

### `commandDisplayOverride(type: 'blank' | 'placeholder' | 'resume', image?: File): Promise<void>` (Update 02)

**Purpose**: Command connected display wall sessions to blank, show placeholder, or resume

**Parameters**:
- `type`: Override type
- `image`: Optional per-action override image for placeholder

**Business Rules**:
- Available to Admins from the admin panel (also available to Moderators from moderation panel)
- Broadcasts command via RealtimeService
- Override state persisted in database
- Log action in audit log (NFR-22)

---

### `uploadDefaultPlaceholder(image: File): Promise<void>` (Update 02)

**Purpose**: Upload or replace the system-wide default placeholder image

**Parameters**:
- `image`: Placeholder image file

**Business Rules**:
- Only accessible by Admin (via system parameters)
- Stored in system config / filesystem storage
- Log action in audit log (NFR-22)

---

### `getDisplayOverrideState(): Promise<DisplayOverrideState>` (Update 02)

**Purpose**: Get current display override state

**Returns**: DisplayOverrideState with `type` ('normal' | 'blank' | 'placeholder') and optional `imageUrl`

**Business Rules**:
- Only accessible by Admin
- Return the persisted state from database

---

## AuthComponent Methods

### `login(username: string, password: string): Promise<AuthResult>`

**Purpose**: Generic login for Moderators and Admins

**Parameters**:
- `username`: Username
- `password`: Password

**Returns**: `AuthResult` with user info, role, and session token

**Business Rules**:
- Authenticate against user database
- Check if account is disabled — reject login with "Account disabled" error (Update 01 — FR-15a)
- Determine role (moderator/admin)
- Create session with role-based permissions

---

### `logout(): Promise<void>`

**Purpose**: End user session

**Business Rules**:
- Invalidate session token
- Clear local storage
- Redirect to login page

---

### `changePassword(currentPassword: string, newPassword: string): Promise<void>`

**Purpose**: Change user's own password

**Parameters**:
- `currentPassword`: Current password for verification
- `newPassword`: New password

**Business Rules**:
- Verify current password
- Validate new password meets complexity requirements
- Update password in database
- Log password change in audit log (NFR-22, Update 01)

---

### `getCurrentUser(): User | null`

**Purpose**: Get currently authenticated user

**Returns**: User object or null if not authenticated

---

### `isAuthenticated(): boolean`

**Purpose**: Check if user is authenticated

**Returns**: Boolean indicating authentication status

---

### `hasRole(role: 'moderator' | 'admin' | 'display_wall'): boolean`

**Purpose**: Check if current user has specific role

**Parameters**:
- `role`: Role to check ('moderator', 'admin', or 'display_wall')

**Returns**: Boolean indicating role membership

---

### `isAccountDisabled(): Promise<boolean>` (Update 01)

**Purpose**: Check if current user's account is disabled

**Returns**: Boolean indicating disabled status

**Business Rules**:
- Check the `disabled` field on the user record
- Used on login to prevent disabled accounts from authenticating

---

## PhotoWallService Methods

### `submitSubmission(data: SubmissionData): Promise<Submission>`

**Purpose**: Process new submission

**Parameters**:
- `data`: SubmissionData with photo, message, name, socialHandle

**Returns**: Created Submission object with "pending" status

**Business Rules**:
- Validate submission data
- Compress and upload image
- Run AutoModeratorService.checkMessage() on message (Update 01)
- Create submission record with "pending" status + flagged word data
- Log submission in audit log (NFR-22, Update 01)
- Publish "submission_created" event

---

### `editSubmission(id: string, data: SubmissionEditData, moderatorId: string): Promise<Submission>` (Update 01)

**Purpose**: Edit submission content

**Parameters**:
- `id`: Submission ID
- `data`: Updated fields (message, name, social_handle)
- `moderatorId`: ID of the editing moderator

**Returns**: Updated Submission with edit metadata

**Business Rules**:
- Can edit pending or approved submissions
- Preserve old values in audit log
- Update edited_by, edited_at, increment edit_count
- Publish "submission_edited" event to update display wall
- Show edited indicator in moderation panel

---

### `getPendingSubmissions(): Promise<Submission[]>`

**Purpose**: Get all pending submissions

**Returns**: Array of pending submissions

**Business Rules**:
- Only accessible by authenticated moderators/admins
- Ordered by submission timestamp (oldest first)
- Include flagged word data for auto-moderator highlighting (Update 01)

---

### `getApprovedSubmissions(): Promise<Submission[]>`

**Purpose**: Get all approved submissions for display

**Returns**: Array of approved submissions

**Business Rules**:
- Ordered by approval timestamp (oldest first)
- Include all data needed for display

---

### `approveSubmission(id: string, moderatorId: string): Promise<Submission>` (Update 01)

**Purpose**: Approve a submission (now includes moderatorId for audit)

**Parameters**:
- `id`: Submission ID
- `moderatorId`: ID of the approving moderator

**Returns**: Updated Submission with "approved" status

**Business Rules**:
- Only accessible by authenticated moderators/admins
- Set status to "approved"
- Set approval timestamp and approved_by (moderatorId)
- Log action in audit log (NFR-22)
- Publish "submission_approved" event

---

### `rejectSubmission(id: string, moderatorId: string, reason?: string): Promise<Submission>` (Update 01)

**Purpose**: Reject a submission (now includes moderatorId for audit)

**Parameters**:
- `id`: Submission ID
- `moderatorId`: ID of the rejecting moderator
- `reason`: Optional rejection reason

**Returns**: Updated Submission with "rejected" status

**Business Rules**:
- Only accessible by authenticated moderators/admins
- Set status to "rejected"
- Store rejection reason if provided
- Log action in audit log (NFR-22)

---

### `deleteSubmission(id: string, moderatorId: string): Promise<void>` (Update 01)

**Purpose**: Delete a submission (now includes moderatorId for audit)

**Parameters**:
- `id`: Submission ID
- `moderatorId`: ID of the deleting moderator

**Business Rules**:
- Only accessible by authenticated moderators/admins
- Delete submission record
- Delete associated image from storage
- Log action in audit log (NFR-22)
- Publish "submission_deleted" event

---

### `publishNewSubmission(submission: Submission): void`

**Purpose**: Publish event for new submission

**Parameters**:
- `submission`: New submission object

**Business Rules**:
- Publish to "submissions" channel
- Event type: "submission_created"
- Trigger real-time updates for moderators

---

### `subscribeToApproved(callback: (submission: Submission) => void): UnsubscribeFn`

**Purpose**: Subscribe to approved submission events

**Parameters**:
- `callback`: Function called when submission is approved

**Returns**: Unsubscribe function

**Business Rules**:
- Subscribe to "submissions" channel
- Filter for "submission_approved" events
- Trigger real-time updates for display wall

---

### `publishTrainCommand(command: TrainCommand): void` (Update 01)

**Purpose**: Publish train control command (pause/play/jump)

**Parameters**:
- `command`: TrainCommand with type ('pause' | 'play' | 'jump') and optional cabin number

**Business Rules**:
- Only callable by authenticated moderators/admins
- Publish to "train_commands" channel
- Connected display wall tabs receive and execute the command

---

### `subscribeToTrainCommands(callback: (command: TrainCommand) => void): UnsubscribeFn` (Update 01)

**Purpose**: Subscribe to train control commands

**Parameters**:
- `callback`: Function called when train command is received

**Returns**: Unsubscribe function

**Business Rules**:
- Subscribe to "train_commands" channel
- Execute command (pause/play/jump) on the display wall

---

### `listModerators(): Promise<Moderator[]>`

**Purpose**: List all Photo Moderator accounts

**Returns**: Array of moderator objects with status

---

### `createModerator(username: string, initialPassword: string, adminId: string): Promise<void>` (Update 01)

**Purpose**: Create a new moderator account (now includes adminId for audit)

**Parameters**:
- `username`: New moderator username
- `initialPassword`: Initial password
- `adminId`: ID of the creating admin

**Business Rules**:
- Log action in audit log (NFR-22)

---

### `disableModerator(moderatorId: string, adminId: string): Promise<void>` (Update 01)

**Purpose**: Disable a moderator account

**Parameters**:
- `moderatorId`: Moderator to disable
- `adminId`: Admin performing the action

**Business Rules**:
- Set disabled flag on user
- Log action in audit log

---

### `enableModerator(moderatorId: string, adminId: string): Promise<void>` (Update 01)

**Purpose**: Re-enable a disabled moderator account

**Parameters**:
- `moderatorId`: Moderator to enable
- `adminId`: Admin performing the action

**Business Rules**:
- Clear disabled flag on user
- Log action in audit log

---

### `deleteModerator(moderatorId: string, adminId: string): Promise<void>` (Update 01)

**Purpose**: Delete a moderator account

**Parameters**:
- `moderatorId`: Moderator to delete
- `adminId`: Admin performing the action

**Business Rules**:
- Delete account but preserve audit log references
- Log action in audit log

---

### `getSystemParameters(): Promise<SystemConfig[]>` (Update 01)

**Purpose**: Get all system parameters

**Returns**: Array of SystemConfig objects

---

### `updateSystemParameter(key: string, value: string, adminId: string): Promise<void>` (Update 01)

**Purpose**: Update a system parameter

**Parameters**:
- `key`: Parameter key
- `value`: New value
- `adminId`: Admin performing the update

**Business Rules**:
- Validate value (e.g. dwell time 3-60s)
- Persist to database
- Broadcast change via RealtimeService
- Log old/new values in audit log

---

### `resetSystemParameterToDefault(key: string, adminId: string): Promise<void>` (Update 01)

**Purpose**: Reset a system parameter to default

**Parameters**:
- `key`: Parameter key
- `adminId`: Admin performing the reset

---

### `getAuditLog(filters: AuditFilter): Promise<AuditEntry[]>` (Update 01)

**Purpose**: Get filtered audit log entries

**Parameters**:
- `filters`: Filter criteria

**Returns**: Array of matching audit entries

---

### `listDisplayWallUsers(): Promise<DisplayWallUser[]>` (Update 02)

**Purpose**: List all Display Wall User accounts

**Returns**: Array of Display Wall User objects

---

### `createDisplayWallUser(username: string, initialPassword: string, adminId: string): Promise<void>` (Update 02)

**Purpose**: Create new Display Wall User account

**Parameters**:
- `username`: New Display Wall User username
- `initialPassword`: Initial password
- `adminId`: Admin performing the action

**Business Rules**:
- Username must be unique across all user types
- Log action in audit log

---

### `disableDisplayWallUser(userId: string, adminId: string): Promise<void>` (Update 02)

**Purpose**: Disable a Display Wall User account

**Parameters**:
- `userId`: Display Wall User ID
- `adminId`: Admin performing the action

---

### `deleteDisplayWallUser(userId: string, adminId: string): Promise<void>` (Update 02)

**Purpose**: Permanently delete a Display Wall User account

**Parameters**:
- `userId`: Display Wall User ID
- `adminId`: Admin performing the action

---

### `commandDisplayOverride(type: 'blank' | 'placeholder' | 'resume', userId: string, image?: File): Promise<void>` (Update 02)

**Purpose**: Command display wall override from mod/admin panel

**Parameters**:
- `type`: Override type
- `userId`: User issuing the command
- `image`: Optional per-action override image for placeholder

**Business Rules**:
- Broadcast via RealtimeService
- Persist override state in database
- Log action in audit log

---

### `getDisplayOverrideState(): Promise<DisplayOverrideState>` (Update 02)

**Purpose**: Get current display override state

**Returns**: DisplayOverrideState with type and optional image URL

---

### `uploadDefaultPlaceholder(image: File, adminId: string): Promise<void>` (Update 02)

**Purpose**: Upload or replace the system-wide default placeholder image

**Parameters**:
- `image`: Placeholder image file
- `adminId`: Admin performing the action

**Business Rules**:
- Store image in filesystem/storage
- Update system config reference
- Log action in audit log

---

## Repository Methods

### `createSubmission(data: SubmissionData): Promise<Submission>`

**Purpose**: Create new submission record

**Parameters**:
- `data`: SubmissionData object

**Returns**: Created Submission with generated ID

**Business Rules**:
- Generate unique ID
- Set status to "pending"
- Set submission timestamp
- Store `flagged_words` and `is_flagged` if auto-moderator flagged (Update 01)
- Store in `submissions` table

---

### `getSubmissionsByStatus(status: 'pending' | 'approved' | 'rejected'): Promise<Submission[]>`

**Purpose**: Query submissions by status

**Parameters**:
- `status`: Submission status to filter

**Returns**: Array of matching submissions

**Business Rules**:
- Filter by status field
- Order by appropriate timestamp (submission or approval)

---

### `updateSubmissionStatus(id: string, status: SubmissionStatus, moderatorId: string): Promise<Submission>` (Update 01)

**Purpose**: Update submission status (now includes moderatorId)

**Parameters**:
- `id`: Submission ID
- `status`: New status
- `moderatorId`: ID of moderator performing action

**Returns**: Updated Submission

**Business Rules**:
- Update status field
- Set appropriate timestamp (approval timestamp if approved)
- Set approved_by field with moderator ID
- Return updated record

---

### `updateSubmissionContent(id: string, data: SubmissionEditData, moderatorId: string): Promise<Submission>` (Update 01)

**Purpose**: Update submission content (message, name, social handle)

**Parameters**:
- `id`: Submission ID
- `data`: Updated content fields
- `moderatorId`: ID of editing moderator

**Returns**: Updated Submission with edit metadata

**Business Rules**:
- Update message, name, social_handle as provided
- Set edited_by, edited_at
- Increment edit_count

---

### `deleteSubmission(id: string): Promise<void>`

**Purpose**: Delete submission record

**Parameters**:
- `id`: Submission ID

**Business Rules**:
- Remove from database
- Cascade delete related data if needed

---

### `authenticateUser(username: string, password: string): Promise<User | null>`

**Purpose**: Authenticate user (check disabled status — Update 01)

**Parameters**:
- `username`: Username
- `password`: Password (plain text, will be hashed for comparison)

**Returns**: User object if credentials valid and account active, null otherwise

**Business Rules**:
- Hash password and compare with stored hash
- Return user with role if match and account is not disabled
- Null if no match, user not found, or account is disabled

---

### `createUser(data: CreateUserData): Promise<User>`

**Purpose**: Create new user

**Parameters**:
- `data`: CreateUserData with username, password, role

**Returns**: Created User (excluding password hash)

**Business Rules**:
- Hash password before storing
- Validate username uniqueness
- Set creation timestamp
- Assign role (moderator/admin)
- Set disabled = false by default

---

### `updateUserPassword(userId: string, newPassword: string): Promise<void>`

**Purpose**: Update user password

**Parameters**:
- `userId`: User ID
- `newPassword`: New password (plain text, will be hashed)

**Business Rules**:
- Hash new password
- Update password hash in database
- Invalidate existing sessions

---

### `listModerators(): Promise<Moderator[]>`

**Purpose**: List all moderators with status

**Returns**: Array of moderator objects

**Business Rules**:
- Include `disabled` status in result (Update 01 — FR-15c)

---

### `createModerator(username: string, password: string): Promise<void>`

**Purpose**: Create moderator account

**Parameters**:
- `username`: Unique username
- `password`: Initial password (hashed before storage)

---

### `resetModeratorPassword(moderatorId: string, newPassword: string): Promise<void>`

**Purpose**: Reset moderator password

**Parameters**:
- `moderatorId`: Moderator ID
- `newPassword`: New password (hashed before storage)

---

### `disableModerator(moderatorId: string): Promise<void>` (Update 01)

**Purpose**: Disable a moderator account

**Parameters**:
- `moderatorId`: Moderator ID

**Business Rules**:
- Set disabled = true on user record
- Set disabled_at timestamp

---

### `enableModerator(moderatorId: string): Promise<void>` (Update 01)

**Purpose**: Enable a disabled moderator account

**Parameters**:
- `moderatorId`: Moderator ID

**Business Rules**:
- Set disabled = false on user record
- Clear disabled_at timestamp

---

### `deleteModerator(moderatorId: string): Promise<void>` (Update 01)

**Purpose**: Delete a moderator account

**Parameters**:
- `moderatorId`: Moderator ID

**Business Rules**:
- Remove user record from database
- Audit log entries retain the moderator ID reference

---

### `createAuditEntry(entry: AuditEntryData): Promise<void>` (Update 01)

**Purpose**: Create an audit log entry

**Parameters**:
- `entry`: AuditEntryData with moderator_id, action_type, target_type, target_id, old_value, new_value, timestamp

**Business Rules**:
- Append-only — no update or delete operations permitted on audit entries

---

### `getAuditLog(filters: AuditFilter): Promise<AuditEntry[]>` (Update 01)

**Purpose**: Query audit log entries with filters

**Parameters**:
- `filters`: Filter criteria (moderator_id, action_type, date_range, target_type)

**Returns**: Array of matching AuditEntry objects

**Business Rules**:
- Support filtering by: moderator, action type, date range, target type
- Order by timestamp descending (most recent first)
- Read-only — no modification of entries

---

### `getSystemConfig(key: string): Promise<SystemConfig | null>` (Update 01)

**Purpose**: Get a single system config value

**Parameters**:
- `key`: Config key

**Returns**: SystemConfig object or null if not found

---

### `getAllSystemConfigs(): Promise<SystemConfig[]>` (Update 01)

**Purpose**: Get all system config values

**Returns**: Array of SystemConfig objects

---

### `upsertSystemConfig(key: string, value: string, updatedBy: string): Promise<void>` (Update 01)

**Purpose**: Insert or update a system config value

**Parameters**:
- `key`: Config key
- `value`: New value
- `updatedBy`: Admin user ID

**Business Rules**:
- Upsert (insert if not exists, update if exists)
- Set updated_at timestamp
- Keep default_value unchanged on update

---

### `resetSystemConfigToDefault(key: string): Promise<void>` (Update 01)

**Purpose**: Reset a config value to its default

**Parameters**:
- `key`: Config key

**Business Rules**:
- Set value = default_value from the database
- For auto_moderator_word_list, restores the seeded PG-13 default list

---

### `createDisplayWallUser(username: string, password: string): Promise<void>` (Update 02)

**Purpose**: Create a Display Wall User in the database

**Parameters**:
- `username`: Display Wall User username
- `password`: Hashed password

**Business Rules**:
- Role set to 'display_wall'
- Username must be unique across all user types

---

### `listDisplayWallUsers(): Promise<DisplayWallUser[]>` (Update 02)

**Purpose**: List all Display Wall User accounts

**Returns**: Array of Display Wall User objects with status

---

### `disableDisplayWallUser(userId: string): Promise<void>` (Update 02)

**Purpose**: Disable a Display Wall User account

---

### `deleteDisplayWallUser(userId: string): Promise<void>` (Update 02)

**Purpose**: Permanently delete a Display Wall User account

---

### `getDisplayOverrideState(): Promise<DisplayOverrideState>` (Update 02)

**Purpose**: Get the persisted display override state

**Returns**: DisplayOverrideState with `type` and optional `imageUrl`

---

### `setDisplayOverrideState(state: DisplayOverrideState): Promise<void>` (Update 02)

**Purpose**: Persist the display override state

**Parameters**:
- `state`: DisplayOverrideState to persist

---

## StorageService Methods

### `uploadImage(file: Blob, submissionId: string): Promise<string>`

**Purpose**: Upload image to storage

**Parameters**:
- `file`: Compressed image blob
- `submissionId`: Associated submission ID

**Returns**: URL or path to stored image

**Business Rules**:
- Generate unique filename (submissionId + timestamp)
- Store in appropriate bucket/folder
- Return accessible URL
- Environment-aware (local filesystem or Supabase Storage)

---

### `getImageUrl(imagePath: string): string`

**Purpose**: Generate accessible URL for stored image

**Parameters**:
- `imagePath`: Path or key of stored image

**Returns**: Full URL for image access

**Business Rules**:
- Generate signed URL if needed (Supabase)
- Return local path for development
- Handle CDN configuration if present

---

### `deleteImage(imagePath: string): Promise<void>`

**Purpose**: Delete stored image

**Parameters**:
- `imagePath`: Path or key of image to delete

**Business Rules**:
- Remove from storage backend
- Handle errors gracefully (don't fail if already deleted)

---

## RealtimeService Methods

### `subscribe(channel: string, callback: (payload: any) => void): UnsubscribeFn`

**Purpose**: Subscribe to real-time channel

**Parameters**:
- `channel`: Channel name (e.g., "submissions", "train_commands")
- `callback`: Handler for channel events

**Returns**: Unsubscribe function

**Business Rules**:
- Local: register in-memory callback
- Production: subscribe via Supabase Realtime
- Handle reconnection automatically

---

### `publish(channel: string, payload: any): Promise<void>`

**Purpose**: Publish event to channel

**Parameters**:
- `channel`: Channel name
- `payload`: Event payload

**Business Rules**:
- Local: invoke registered callbacks
- Production: broadcast via Supabase Realtime
- Include event type and timestamp

---

### `onSubmissionApproved(callback: (submission: Submission) => void): UnsubscribeFn`

**Purpose**: Convenience method for approval events

**Parameters**:
- `callback`: Handler for approval events

**Returns**: Unsubscribe function

**Business Rules**:
- Subscribe to "submissions" channel
- Filter for "submission_approved" events
- Pass submission data to callback

---

### `onSubmissionCreated(callback: (submission: Submission) => void): UnsubscribeFn`

**Purpose**: Convenience method for creation events

**Parameters**:
- `callback`: Handler for creation events

**Returns**: Unsubscribe function

**Business Rules**:
- Subscribe to "submissions" channel
- Filter for "submission_created" events
- Pass submission data to callback

---

### `onSubmissionEdited(callback: (submission: Submission) => void): UnsubscribeFn` (Update 01)

**Purpose**: Convenience method for edit events

**Parameters**:
- `callback`: Handler for edit events

**Returns**: Unsubscribe function

**Business Rules**:
- Subscribe to "submissions" channel
- Filter for "submission_edited" events
- DisplayComponent updates cabin content

---

### `onTrainCommand(callback: (command: TrainCommand) => void): UnsubscribeFn` (Update 01)

**Purpose**: Convenience method for train command events

**Parameters**:
- `callback`: Handler for train commands

**Returns**: Unsubscribe function

**Business Rules**:
- Subscribe to "train_commands" channel
- Execute pause/play/jump on display wall
- Ignored by non-display components

---

### `onSystemConfigChanged(callback: (config: SystemConfig) => void): UnsubscribeFn` (Update 01)

**Purpose**: Convenience method for system config change events

**Parameters**:
- `callback`: Handler for config changes

**Returns**: Unsubscribe function

**Business Rules**:
- Subscribe to "system_config" channel
- DisplayComponent applies new dwell time
- UploadComponent updates prompt text if changed
- ModerationComponent refreshes word list if changed

---

### `onDisplayOverride(callback: (command: DisplayOverrideCommand) => void): UnsubscribeFn` (Update 02)

**Purpose**: Subscribe to display override events (blank/placeholder/resume)

**Parameters**:
- `callback`: Handler for display override commands

**Returns**: Unsubscribe function

**Business Rules**:
- Subscribe to "display_override" channel
- DisplayComponent responds by showing blank, placeholder, or resuming train
- All connected display wall sessions receive the command simultaneously

---

## AuditService Methods (New — Update 01)

### `logAction(action: AuditAction): Promise<void>`

**Purpose**: Log an auditable action

**Parameters**:
- `action`: AuditAction with moderator_id, action_type, target_type, target_id, old_value, new_value

**Business Rules**:
- Generate UUID for entry
- Set timestamp with millisecond precision
- Delegate to Repository.createAuditEntry()
- Fail gracefully — audit failure does not block the primary operation

---

### `getLog(filters: AuditFilter): Promise<AuditEntry[]>`

**Purpose**: Get filtered audit log entries

**Parameters**:
- `filters`: Filter criteria

**Returns**: Array of matching AuditEntry objects

**Business Rules**:
- Read-only query — no modification of entries
- Delegate to Repository.getAuditLog()

---

## AutoModeratorService Methods (New — Update 01)

### `checkMessage(message: string, wordList: string[]): FlagResult`

**Purpose**: Check a submission message against the flagged word list

**Parameters**:
- `message`: Submission message text
- `wordList`: Array of flagged words from system parameters

**Returns**: FlagResult with isFlagged boolean and array of matched words with positions

**Business Rules**:
- Advisory only — moderator retains final approval discretion
- Case-insensitive matching
- Unicode character support
- Basic character substitution (e.g. @ for a, 3 for e)
- Returns position info for UI highlighting

---

### `getFlaggedWords(message: string, wordList: string[]): string[]`

**Purpose**: Get the list of words in a message that match the flagged word list

**Parameters**:
- `message`: Submission message text
- `wordList`: Array of flagged words

**Returns**: Array of matched words (for UI display)

**Business Rules**:
- Same matching rules as checkMessage
- Returns only the matched words, not positions (for simple display)