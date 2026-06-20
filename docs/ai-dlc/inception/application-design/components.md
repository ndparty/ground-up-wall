# Components — ground-up-wall (Updated for Update 02)

## Architecture Overview

**Architectural Style**: Hybrid (UI components + shared services)  
**Service Pattern**: Facade (monolithic PhotoWallService)  
**Database**: `submissions`, `users`, `audit_log`, `system_config` tables (Update 01 adds audit_log + system_config)  
**Real-time**: Environment-adaptive (local events / Supabase Realtime)

---

## Component Catalog

### 1. UploadComponent

**Purpose**: Handles photo submission from participants (no login required)

**Responsibilities**:
- Display upload form (photo, message, name, optional social handle)
- Display configurable prompt text in message field (from system parameters)
- Display data privacy notice (indefinite retention, social media use) before submission (FR-02a updated, Update 02)
- Display posting guidelines disclaimer on form and success page (FR-02b updated, Update 02)
- Display mandatory acknowledgment checkbox (FR-02a updated)
- Validate message against configurable length limit and unit (characters or words)
- Display live counter for message length
- Client-side image compression before upload
- Form validation (file type, size, message length)
- Submit to backend via PhotoWallService
- Display success confirmation with disclaimer

**Interfaces**:
- `submitPhoto(photo: File, message: string, name: string, socialHandle?: string): Promise<SubmissionResult>`
- `validateForm(data: UploadData, limitConfig: {limit: number, unit: 'characters' | 'words'}): ValidationResult`
- `compressImage(file: File, maxWidth: number, quality: number): Promise<Blob>`
- `getPromptText(): Promise<string>` (Update 01: load configurable prompt from system parameters)
- `getMessageLimitConfig(): Promise<{limit: number, unit: 'characters' | 'words'}>` (Update 02)
- `showPrivacyNotice(): void` (Update 01: display data privacy notice)
- `showAcknowledgmentCheckbox(): void` (Update 02: display mandatory acknowledgment checkbox)

**UI Routes**: `/upload`, `/` (home redirects to upload)

---

### 2. DisplayComponent

**Purpose**: Renders the SMRT train animation on the TV screen

**Responsibilities**:
- Fetch approved submissions (initial load)
- Subscribe to real-time updates for new approvals, edits, deletions
- Render train animation (scrolling left, cabin-by-cabin focus)
- Manage cabin transition timing (configurable via system parameters, FR-19 Update 01)
- Display branded waiting screen when no submissions exist
- Maintain 60fps animation performance
- Pause/play/jump-to-cabin controls (visible to logged-in Moderators/Admins only, FR-24a Update 01)
  - **Jump-to-cabin** uses the K-buffer forward-only model in `lib/train/train_view.ts`: temporarily collapse ring nodes between V+K and T−K, animate a single proportional slide to target, then snap. See Update 03 in `component-methods.md`.
  - Server dwell timer pauses during blank/placeholder override (FR-24c); resume recenters on frozen cabin.
- Require authentication (Display Wall User / Photo Moderator / Admin only); show 403 message for unauthenticated/Participant access (FR-24b revised, Update 02)
- Respond to display override commands (blank screen, placeholder image, resume) from mod/admin panel via RealtimeService (FR-24c, Update 02)
- On refresh, client bootstraps from server playback state (`currentCabin`, `isPlaying`) — see verification note on FR-24a vs NFR-11
**Interfaces**:
- `loadApprovedSubmissions(): Promise<Submission[]>`
- `subscribeToUpdates(callback: (submission: Submission) => void): UnsubscribeFn`
- `renderTrain(submissions: Submission[]): void`
- `useTrainPlayback()` hook — pause/play/jump, SSE sync (Update 03)
- `checkAuthAccess(): Promise<{allowed: boolean, role: string}>` (Update 02)
- `handleDisplayOverride(command: DisplayOverrideCommand): void` (Update 02)
- `subscribeToDisplayOverride(callback: (command: DisplayOverrideCommand) => void): UnsubscribeFn` (Update 02)

**UI Routes**: `/display`, `/wall`

---

### 3. ModerationComponent

**Purpose**: Interface for Photo Moderators to review, approve/reject, and edit submissions

**Responsibilities**:
- Display login form for Photo Moderators/Admins
- Show moderation queue (pending submissions)
- Preview submission (photo + message + name + social handle)
- Approve or reject each submission
- Edit submission content (message, name, social handle) with audit trail (FR-09 extended, Update 01)
- Show edited indicator with moderator name on previously edited submissions (FR-09)
- Display auto-moderator flagged words with visual highlighting (e.g. underlined/highlighted) (FR-09a, Update 01)
- Delete previously approved submissions
- Command display override (blank/placeholder/resume) from moderation panel (FR-24c, Update 02)
- Real-time updates when new submissions arrive

**Interfaces**:
- `login(username: string, password: string): Promise<AuthResult>`
- `loadPendingSubmissions(): Promise<Submission[]>`
- `approveSubmission(id: string): Promise<void>`
- `rejectSubmission(id: string, reason?: string): Promise<void>`
- `editSubmission(id: string, data: SubmissionEditData): Promise<Submission>` (Update 01)
- `deleteApprovedSubmission(id: string): Promise<void>`
- `subscribeToNewSubmissions(callback: (submission: Submission) => void): UnsubscribeFn`
- `getFlaggedWords(message: string): string[]` (Update 01: determine which words to highlight)
- `commandDisplayOverride(type: 'blank' | 'placeholder' | 'resume', image?: File): Promise<void>` (Update 02)

**UI Routes**: `/moderate`, `/moderator/login`

---

### 4. AdminComponent

**Purpose**: Admin-only interface for managing the system

**Responsibilities**:
- Display login form for Admins
- List existing Photo Moderator accounts with active/disabled status (FR-15c, Update 01)
- Create new Photo Moderator accounts (username + initial password)
- Reset passwords for existing moderators
- Disable/enable moderator accounts (FR-15a, Update 01)
- Delete moderator accounts with confirmation (FR-15b, Update 01)
- System parameters configuration panel (FR-13a, Update 01):
  - Train dwell time (3-60s, default 15s)
  - Message prompt text
  - Auto-moderator word list
  - Message length limit
  - Message length unit
  - Default placeholder image
  - Reset to default for each parameter
- View audit log with filtering by moderator, action type, date range, target type (NFR-22, Update 01)
- Manage Display Wall User accounts (create, disable, delete) (FR-24b revised, Update 02)
- Command display override (blank/placeholder/resume) from admin panel (FR-24c, Update 02)
- Upload/replace default placeholder image (FR-13a extended, Update 02)
- Access to Instagram hashtag configuration (Phase 3)

**Interfaces**:
- `login(username: string, password: string): Promise<AuthResult>`
- `listModerators(): Promise<Moderator[]>`
- `createModerator(username: string, initialPassword: string): Promise<void>`
- `resetModeratorPassword(moderatorId: string, newPassword: string): Promise<void>`
- `disableModerator(moderatorId: string): Promise<void>` (Update 01)
- `enableModerator(moderatorId: string): Promise<void>` (Update 01)
- `deleteModerator(moderatorId: string): Promise<void>` (Update 01)
- `getSystemParameters(): Promise<SystemConfig[]>` (Update 01)
- `updateSystemParameter(key: string, value: string): Promise<void>` (Update 01)
- `resetSystemParameterToDefault(key: string): Promise<void>` (Update 01)
- `getAuditLog(filters: AuditFilter): Promise<AuditEntry[]>` (Update 01)
- `listDisplayWallUsers(): Promise<DisplayWallUser[]>` (Update 02)
- `createDisplayWallUser(username: string, initialPassword: string): Promise<void>` (Update 02)
- `disableDisplayWallUser(userId: string): Promise<void>` (Update 02)
- `deleteDisplayWallUser(userId: string): Promise<void>` (Update 02)
- `commandDisplayOverride(type: 'blank' | 'placeholder' | 'resume', image?: File): Promise<void>` (Update 02)
- `uploadDefaultPlaceholder(image: File): Promise<void>` (Update 02)
- `getDisplayOverrideState(): Promise<DisplayOverrideState>` (Update 02)
- `configureInstagramHashtag(hashtag: string): Promise<void>` (Phase 3)

**UI Routes**: `/admin`, `/admin/login`

---

### 5. AuthComponent

**Purpose**: Shared authentication functionality for Moderators and Admins

**Responsibilities**:
- Handle login/logout
- Check disabled account status on login (Update 01 — FR-15a)
- Session management
- Password change functionality
- Role-based access control (Participant upload-only, Moderator, Admin, Display Wall User)
- Protected route guards

**Interfaces**:
- `login(username: string, password: string): Promise<AuthResult>`
- `logout(): Promise<void>`
- `changePassword(currentPassword: string, newPassword: string): Promise<void>`
- `getCurrentUser(): User | null`
- `isAuthenticated(): boolean`
- `hasRole(role: 'moderator' | 'admin' | 'display_wall'): boolean`
- `isAccountDisabled(): Promise<boolean>` (Update 01: check disabled status)

**UI Routes**: `/login`, `/change-password`

---

### 6. PhotoWallService (Shared Service Layer)

**Purpose**: Central service facade coordinating all business operations

**Responsibilities**:
- Orchestrate submission lifecycle (upload → moderation → display)
- Manage database operations via Repository
- Handle real-time event distribution
- Coordinate image storage operations
- Enforce business rules and validation
- Environment-aware operations (local vs production)
- Audit logging for moderator/admin actions (Update 01)
- Auto-moderator content flagging (Update 01)
- System parameters configuration (Update 01)
- Display override controls (blank/placeholder/resume) from mod/admin panel (Update 02)
- Display Wall User account management (Update 02)
- Train control command publishing (Update 01)

**Interfaces**:
- `submitSubmission(data: SubmissionData): Promise<Submission>`
- `editSubmission(id: string, data: SubmissionEditData, moderatorId: string): Promise<Submission>` (Update 01)
- `getPendingSubmissions(): Promise<Submission[]>`
- `getApprovedSubmissions(): Promise<Submission[]>`
- `approveSubmission(id: string, moderatorId: string): Promise<Submission>`
- `rejectSubmission(id: string, moderatorId: string, reason?: string): Promise<Submission>`
- `deleteSubmission(id: string, moderatorId: string): Promise<void>`
- `publishNewSubmission(submission: Submission): void`
- `subscribeToApproved(callback: (submission: Submission) => void): UnsubscribeFn`
- `publishTrainCommand(command: TrainCommand): void` (Update 01)
- `subscribeToTrainCommands(callback: (command: TrainCommand) => void): UnsubscribeFn` (Update 01)
- `listModerators(): Promise<Moderator[]>`
- `createModerator(username: string, password: string, adminId: string): Promise<void>`
- `disableModerator(moderatorId: string, adminId: string): Promise<void>` (Update 01)
- `enableModerator(moderatorId: string, adminId: string): Promise<void>` (Update 01)
- `deleteModerator(moderatorId: string, adminId: string): Promise<void>` (Update 01)
- `getSystemParameters(): Promise<SystemConfig[]>` (Update 01)
- `updateSystemParameter(key: string, value: string, adminId: string): Promise<void>` (Update 01)
- `resetSystemParameterToDefault(key: string, adminId: string): Promise<void>` (Update 01)
- `getAuditLog(filters: AuditFilter): Promise<AuditEntry[]>` (Update 01)
- `commandDisplayOverride(type: 'blank' | 'placeholder' | 'resume', image?: File, userId: string): Promise<void>` (Update 02)
- `getDisplayOverrideState(): Promise<DisplayOverrideState>` (Update 02)
- `subscribeToDisplayOverride(callback: (command: DisplayOverrideCommand) => void): UnsubscribeFn` (Update 02)
- `listDisplayWallUsers(): Promise<DisplayWallUser[]>` (Update 02)
- `createDisplayWallUser(username: string, password: string, adminId: string): Promise<void>` (Update 02)
- `disableDisplayWallUser(userId: string, adminId: string): Promise<void>` (Update 02)
- `deleteDisplayWallUser(userId: string, adminId: string): Promise<void>` (Update 02)
- `uploadDefaultPlaceholder(image: File, adminId: string): Promise<void>` (Update 02)

---

### 7. Repository (Data Access Layer)

**Purpose**: Abstracted data access for submissions, users, configuration, and audit log

**Responsibilities**:
- CRUD operations for submissions (including content update for edits)
- User authentication and management (including disable/enable/delete)
- Display Wall User account CRUD
- Audit log operations (append-only create, filterable read)
- System config operations (upsert, read all, reset to default)
- Environment-aware data access (local Postgres vs Supabase)
- Query optimization for display wall (chronological ordering)

**Interfaces**:
- `createSubmission(data: SubmissionData): Promise<Submission>`
- `getSubmissionsByStatus(status: 'pending' | 'approved' | 'rejected'): Promise<Submission[]>`
- `updateSubmissionStatus(id: string, status: SubmissionStatus, moderatorId: string): Promise<Submission>`
- `updateSubmissionContent(id: string, data: SubmissionEditData, moderatorId: string): Promise<Submission>` (Update 01)
- `deleteSubmission(id: string): Promise<void>`
- `authenticateUser(username: string, password: string): Promise<User | null>`
- `createUser(data: CreateUserData): Promise<User>`
- `updateUserPassword(userId: string, newPassword: string): Promise<void>`
- `listModerators(): Promise<Moderator[]>`
- `createModerator(username: string, password: string): Promise<void>`
- `resetModeratorPassword(moderatorId: string, newPassword: string): Promise<void>`
- `disableModerator(moderatorId: string): Promise<void>` (Update 01)
- `enableModerator(moderatorId: string): Promise<void>` (Update 01)
- `deleteModerator(moderatorId: string): Promise<void>` (Update 01)
- `createAuditEntry(entry: AuditEntryData): Promise<void>` (Update 01)
- `getAuditLog(filters: AuditFilter): Promise<AuditEntry[]>` (Update 01)
- `getSystemConfig(key: string): Promise<SystemConfig | null>` (Update 01)
- `getAllSystemConfigs(): Promise<SystemConfig[]>` (Update 01)
- `upsertSystemConfig(key: string, value: string, updatedBy: string): Promise<void>` (Update 01)
- `resetSystemConfigToDefault(key: string): Promise<void>` (Update 01)
- `createDisplayWallUser(username: string, password: string): Promise<void>` (Update 02)
- `listDisplayWallUsers(): Promise<DisplayWallUser[]>` (Update 02)
- `disableDisplayWallUser(userId: string): Promise<void>` (Update 02)
- `deleteDisplayWallUser(userId: string): Promise<void>` (Update 02)
- `getDisplayOverrideState(): Promise<DisplayOverrideState>` (Update 02)
- `setDisplayOverrideState(state: DisplayOverrideState): Promise<void>` (Update 02)

---

### 8. StorageService (Image Handling)

**Purpose**: Abstracted image storage operations

**Responsibilities**:
- Upload images to storage backend
- Generate URLs for stored images
- Environment-aware storage (local filesystem vs Supabase Storage)
- Image cleanup on submission deletion

**Interfaces**:
- `uploadImage(file: Blob, submissionId: string): Promise<string>` (returns URL)
- `getImageUrl(imagePath: string): string`
- `deleteImage(imagePath: string): Promise<void>`

---

### 9. RealtimeService (Event Distribution)

**Purpose**: Environment-adaptive real-time event system

**Responsibilities**:
- Local development: in-memory event emitter
- Production: Supabase Realtime (websockets)
- Event types: submission_created, submission_approved, submission_rejected, submission_edited, submission_deleted, train_paused, train_resumed, train_jump, system_config_changed, display_override
- Automatic reconnection and error handling

**Interfaces**:
- `subscribe(channel: string, callback: (payload: any) => void): UnsubscribeFn`
- `publish(channel: string, payload: any): Promise<void>`
- `onSubmissionApproved(callback: (submission: Submission) => void): UnsubscribeFn`
- `onSubmissionCreated(callback: (submission: Submission) => void): UnsubscribeFn`
- `onSubmissionEdited(callback: (submission: Submission) => void): UnsubscribeFn` (Update 01)
- `onTrainCommand(callback: (command: TrainCommand) => void): UnsubscribeFn` (Update 01)
- `onSystemConfigChanged(callback: (config: SystemConfig) => void): UnsubscribeFn` (Update 01)
- `onDisplayOverride(callback: (command: DisplayOverrideCommand) => void): UnsubscribeFn` (Update 02)

---

### 10. AuditService (New — Update 01)

**Purpose**: Append-only audit logging for moderator/admin actions

**Responsibilities**:
- Log all auditable actions with moderator ID, action type, target, old/new values, timestamp
- Provide filtered read-only queries
- Enforce append-only policy

**Interfaces**:
- `logAction(action: AuditAction): Promise<void>`
- `getLog(filters: AuditFilter): Promise<AuditEntry[]>`

---

### 11. AutoModeratorService (New — Update 01)

**Purpose**: Content filtering for submission messages against configurable word list

**Responsibilities**:
- Check messages against word list (case-insensitive, Unicode, character substitution)
- Return flagged words with position information for UI highlighting
- Advisory only — moderator retains final approval discretion

**Interfaces**:
- `checkMessage(message: string, wordList: string[]): FlagResult`
- `getFlaggedWords(message: string, wordList: string[]): string[]`

---

## Component Interaction Summary

```
                                              ┌──────────────────┐
                                              │ Display Wall User│
                                              └────────┬─────────┘
                                                       │
┌────────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                                 │
├─────────────┬─────────────┬──────────────┬────────────┬─────────┬──────────┤
│    Upload   │   Display   │  Moderation  │   Admin    │  Auth   │  Audit   │
│  Component  │  Component  │  Component   │  Component │Component│  (Admin  │
│             │             │              │            │         │   View)  │
└──────┬──────┴──────┬──────┴──────┬───────┴──────┬─────┴────┬────┴─────────┘
       │             │             │              │          │
       └─────────────┴─────────────┴──────────────┴──────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER (Facade)                             │
│                          PhotoWallService                                  │
├────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────┐ ┌─────────┐ │
│  │Repository│  │  Storage   │  │   Realtime   │  │  Audit   │ │Moderator│ │
│  │ (Data)   │  │  Service   │  │   Service    │  │  Service │ │ Service │ │
│  │          │  │  (Images)  │  │   (Events)   │  │  (Log)   │ │(Flagging│ │
│  └────┬─────┘  └────┬───────┘  └──────┬───────┘  └────┬─────┘ │ Content)│ │
│       │             │                 │               │       └─────────┘ │
└───────┼─────────────┼─────────────────┼───────────────┼───────────────────┘
        │             │                 │               │
        ▼             ▼                 ▼               ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE LAYER                               │
├────────────────────────────────────────────────────────────────────────────┤
│  Local: Postgres + Filesystem  │  Production: Supabase (Postgres/Storage/ │
│  (PostgresRepository,          │   Realtime)                               │
│   FileStorageService,          │  (SupabaseRepository,                     │
│   MemoryRealtimeService)       │   SupabaseStorageService,                 │
│                                │   SupabaseRealtimeService)                │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 3 Extension Points

| Component | Phase 1 (with Update 01) | Phase 3 Extension |
|-----------|---------------------------|-------------------|
| PhotoWallService | Manual submissions + auto-moderator + audit | Add `fetchInstagramPosts()` method |
| Repository | `submissions`, `users`, `audit_log`, `system_config` tables | Add `source` field (manual/instagram) |
| ModerationComponent | Full moderation with edit, delete, flagged indicators | Show source indicator (IG vs manual) |
| AdminComponent | User management (mods + display wall) + system params + audit log + display override | Add Instagram hashtag config UI |
| RealtimeService | Local/Supabase events + train commands + config changes | Add Instagram webhook handling |
| AuditService | All moderator/admin actions logged | Add Instagram import actions |
| AutoModeratorService | Configurable word list flagging | Extend to Instagram-sourced messages |