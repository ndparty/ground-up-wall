# Services — ground-up-wall (Updated for Update 02)

## Service Layer Architecture

**Pattern**: Facade (Monolithic PhotoWallService)  
**Rationale**: Small one-day project — single coordinating service simplifies development and deployment

---

## PhotoWallService (Main Facade)

### Purpose

Central orchestrator for all photo wall operations. Coordinates between UI components, data access, storage, real-time, audit, and auto-moderator services.

### Responsibilities

1. **Submission Lifecycle Management**
   - Accept new submissions from UploadComponent
   - Coordinate image compression and storage
   - Create submission records in database
   - Run auto-moderator content check on submission messages
   - Publish events for real-time updates

2. **Moderation Workflow**
   - Provide pending submissions to ModerationComponent
   - Process approval/rejection decisions
   - Edit submission content (with audit trail)
   - Update submission status in database
   - Notify display wall of approved/edited/deleted submissions

3. **Display Wall Operations**
   - Serve approved submissions to DisplayComponent
   - Maintain chronological ordering
   - Handle real-time updates for new approvals, edits, and deletions
   - Pause/play/jump train controls (moderator/admin only)
   - Support cabin transition timing via system parameters
   - Display override controls (blank/placeholder/resume) commanded from mod/admin panel, broadcast via RealtimeService

4. **User Management**
   - Authenticate moderators and admins (check disabled accounts)
   - Authenticate Display Wall Users
   - Manage user sessions
   - Handle password changes
   - Enforce role-based access control

5. **Admin Operations**
   - List, create, disable, enable, delete moderator accounts
   - Reset moderator passwords
   - Read and update system parameters (dwell time, prompt text, message length limit/unit, word list, default placeholder image)
   - List, create, disable, delete Display Wall User accounts
   - View and filter audit log

6. **Environment Coordination**
   - Detect execution environment (local vs production)
   - Route operations to appropriate backend services via abstracted interfaces
   - Handle configuration differences transparently via environment-based dependency injection

### Service Interfaces

```typescript
// Main service facade
interface PhotoWallService {
  // Submission operations
  submitSubmission(data: SubmissionData): Promise<Submission>
  editSubmission(id: string, data: SubmissionEditData, moderatorId: string): Promise<Submission>  // Update 01
  getPendingSubmissions(): Promise<Submission[]>
  getApprovedSubmissions(): Promise<Submission[]>
  approveSubmission(id: string, moderatorId: string): Promise<Submission>
  rejectSubmission(id: string, moderatorId: string, reason?: string): Promise<Submission>
  deleteSubmission(id: string, moderatorId: string): Promise<void>
  
  // Real-time operations
  publishNewSubmission(submission: Submission): void
  subscribeToApproved(callback: (submission: Submission) => void): UnsubscribeFn
  publishTrainCommand(command: TrainCommand): void                                     // Update 01
  subscribeToTrainCommands(callback: (command: TrainCommand) => void): UnsubscribeFn   // Update 01
  
  // User operations
  authenticateUser(username: string, password: string): Promise<User | null>
  createUser(data: CreateUserData): Promise<User>
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>
  
  // Admin — Moderator management (Update 01 extensions)
  listModerators(): Promise<Moderator[]>
  createModerator(username: string, initialPassword: string, adminId: string): Promise<void>
  resetModeratorPassword(moderatorId: string, newPassword: string, adminId: string): Promise<void>
  disableModerator(moderatorId: string, adminId: string): Promise<void>                // Update 01
  enableModerator(moderatorId: string, adminId: string): Promise<void>                 // Update 01
  deleteModerator(moderatorId: string, adminId: string): Promise<void>                 // Update 01

  // Admin — System parameters (Update 01)
  getSystemParameters(): Promise<SystemConfig[]>
  updateSystemParameter(key: string, value: string, adminId: string): Promise<void>
  resetSystemParameterToDefault(key: string, adminId: string): Promise<void>

  // Admin — Audit log (Update 01)
  getAuditLog(filters: AuditFilter): Promise<AuditEntry[]>

  // Admin — Display Wall User management (Update 02)
  listDisplayWallUsers(): Promise<DisplayWallUser[]>
  createDisplayWallUser(username: string, initialPassword: string, adminId: string): Promise<void>
  disableDisplayWallUser(userId: string, adminId: string): Promise<void>
  deleteDisplayWallUser(userId: string, adminId: string): Promise<void>

  // Display override controls (Update 02)
  commandDisplayOverride(type: 'blank' | 'placeholder' | 'resume', userId: string, image?: File): Promise<void>
  getDisplayOverrideState(): Promise<DisplayOverrideState>
  subscribeToDisplayOverride(callback: (command: DisplayOverrideCommand) => void): UnsubscribeFn
  uploadDefaultPlaceholder(image: File, adminId: string): Promise<void>
}
```

---

## Supporting Services

### Repository Service (Data Access)

**Purpose**: Abstracted data access layer for database operations

**Responsibilities**:
- CRUD operations for submissions
- User authentication and management (including disable/delete)
- Audit log CRUD (append-only)
- System config CRUD
- Query optimization
- Environment-aware data access (local Postgres vs Supabase)

**Implementation Strategy**:
- Single repository interface
- Environment-specific implementations:
  - `PostgresRepository` (local development)
  - `SupabaseRepository` (production)
- Configuration-driven selection

---

### Storage Service (Image Handling)

**Purpose**: Abstracted image storage operations

**Responsibilities**:
- Upload images to storage backend
- Generate accessible URLs
- Handle image deletion
- Environment-aware storage (local filesystem vs Supabase Storage)

**Implementation Strategy**:
- Single storage interface
- Environment-specific implementations:
  - `FileStorageService` (local development)
  - `SupabaseStorageService` (production)
- Configuration-driven selection

---

### Realtime Service (Event Distribution)

**Purpose**: Environment-adaptive real-time event system

**Responsibilities**:
- Publish events (submission created, approved, rejected, edited, deleted)
- Publish train control commands (pause, play, jump)
- Publish system config changes
- Subscribe to events
- Handle reconnection and error recovery
- Environment-aware event distribution

**Implementation Strategy**:
- Local: In-memory event emitter
- Production: Supabase Realtime (websockets)
- Automatic environment detection

**Events (Extended for Update 01)**:
- `submission_created` → New submission available for moderation
- `submission_approved` → Submission added to display rotation
- `submission_rejected` → Submission removed from queue
- `submission_edited` → Submission content updated on display
- `submission_deleted` → Submission removed from display
- `train_paused` → Display wall freezes on current cabin
- `train_resumed` → Display wall resumes normal transition
- `train_jump` → Display wall jumps to specified cabin
- `system_config_changed` → All components notified of config update
- `display_blank` → All display wall sessions show black screen
- `display_placeholder` → All display wall sessions show placeholder image
- `display_resume` → All display wall sessions resume train animation

---

### Audit Service (New — Update 01)

**Purpose**: Append-only audit logging for moderator and admin actions

**Responsibilities**:
- Record actions with moderator ID, action type, target, old/new values, timestamp
- Provide filtered read-only queries for Admin panel
- Enforce append-only policy (no delete or update of entries)

**Implementation Strategy**:
- Uses Repository interface for database access
- Environment-agnostic (works with both local Postgres and Supabase Postgres)
- Single implementation for all phases

---

### AutoModerator Service (New — Update 01)

**Purpose**: Content flagging for submission messages

**Responsibilities**:
- Check submission messages against configurable word list
- Identify flagged words with position information
- Support case-insensitive matching, Unicode, and basic character substitution (e.g. @ for a)

**Implementation Strategy**:
- Pure logic service — no environment dependencies
- Reads word list from system_config (via PhotoWallService/Repository)
- Returns flagged word positions and match details for UI highlighting
- Advisory only — moderator retains final approval discretion

---

## Service Orchestration Patterns

### Submission Flow

```
UploadComponent
    │
    ▼
PhotoWallService.submitSubmission()
    │
    ├─► Validate submission data
    │
    ├─► Compress image (client-side)
    │
    ├─► StorageService.uploadImage()
    │
    ├─► AutoModeratorService.checkMessage()          ← New (Update 01)
    │
    ├─► Repository.createSubmission()
    │
    ├─► AuditService.logAction('submit')              ← New (Update 01)
    │
    └─► RealtimeService.publish('submission_created')
            │
            ▼
        ModerationComponent (receives real-time update)
```

### Moderation Flow

```
ModerationComponent
    │
    ▼
PhotoWallService.approveSubmission()
    │
    ├─► Repository.updateSubmissionStatus('approved')
    │
    ├─► AuditService.logAction('approve')             ← New (Update 01)
    │
    └─► RealtimeService.publish('submission_approved')
            │
            ├─► DisplayComponent (adds to train)
            │
            └─► ModerationComponent (removes from queue)
```

### Edit Flow (New — Update 01)

```
ModerationComponent
    │
    ▼
PhotoWallService.editSubmission()
    │
    ├─► Repository.updateSubmissionContent()
    │       │
    │       ├─► Store old values in memory for audit
    │       └─► Update with new values
    │
    ├─► AuditService.logAction('edit', oldValues, newValues)
    │
    └─► RealtimeService.publish('submission_edited')
            │
            └─► DisplayComponent (updates cabin content)
```

### Display Flow

```
DisplayComponent
    │
    ├─► PhotoWallService.getApprovedSubmissions()
    │       │
    │       └─► Repository.getSubmissionsByStatus('approved')
    │
    ├─► PhotoWallService.subscribeToApproved()
    │       │
    │       └─► RealtimeService.subscribe('submission_approved')
    │
    ├─► PhotoWallService.subscribeToTrainCommands()    ← New (Update 01)
    │       │
    │       └─► RealtimeService.subscribe('train_*')
    │
    └─► Check auth + display override state on load    ← Revised (Update 02)
            │
            ├─► AuthComponent.checkAuthAccess()
            └─► Repository.getDisplayOverrideState()
```

### Admin: System Parameters Flow (New — Update 01)

```
AdminComponent
    │
    ▼
PhotoWallService.updateSystemParameter('train_dwell_time', '10')
    │
    ├─► Repository.upsertSystemConfig('train_dwell_time', '10', adminId)
    │
    ├─► AuditService.logAction('change_config', oldValue, '10')
    │
    └─► RealtimeService.publish('system_config_changed')
            │
            └─► DisplayComponent (applies new dwell time)
            └─► UploadComponent (updates prompt text if changed)
```

---

## Environment Configuration

### Phase 1 — Local Development (MVP)

```typescript
// Environment: local
const config = {
  database: {
    host: 'localhost',
    port: 5432,
    name: 'ground_up_wall_dev'
  },
  storage: {
    provider: 'filesystem',
    path: './uploads'
  },
  realtime: {
    provider: 'memory'
  }
}

// Phase 1 service implementations (local only)
const repository = new PostgresRepository(config.postgres)
const services = {
  repository,
  storage: new FileStorageService(config.filesystem),
  realtime: new MemoryRealtimeService(),
  audit: new AuditServiceImpl(repository),
  autoModerator: new AutoModeratorServiceImpl()
}

const photoWallService = new PhotoWallService(
  services.repository,
  services.storage,
  services.realtime,
  services.audit,
  services.autoModerator
)
```

### Phase 2 — Production (Deno Deploy + Supabase)

```typescript
// Environment: production
const config = {
  database: {
    provider: 'supabase',
    url: Deno.env.get('SUPABASE_URL'),
    key: Deno.env.get('SUPABASE_ANON_KEY')
  },
  storage: {
    provider: 'supabase',
    bucket: 'submissions'
  },
  realtime: {
    provider: 'supabase',
    url: Deno.env.get('SUPABASE_URL')
  }
}

// Phase 2 implementations — same interface, different backend
const repository = new SupabaseRepository(config.supabase)
const services = {
  repository,
  storage: new SupabaseStorageService(config.supabase),
  realtime: new SupabaseRealtimeService(config.supabase),
  audit: new AuditServiceImpl(repository),          // Same impl, different repo
  autoModerator: new AutoModeratorServiceImpl()       // Pure logic, unchanged
}
```

### Phase 3 — Instagram Integration (extends Phase 2 config)

```typescript
// Environment: production + instagram
const config = {
  database: { /* same as Phase 2 */ },
  storage: { /* same as Phase 2 */ },
  realtime: { /* same as Phase 2 */ },
  instagram: {
    hashtag: Deno.env.get('INSTAGRAM_HASHTAG'),
    apiKey: Deno.env.get('INSTAGRAM_API_KEY'),
    pollInterval: 300000  // 5 minutes
  }
}
```

---

## Phase 3 Extensions

### Instagram Integration Service

**New Service for Phase 3**:

```typescript
interface InstagramService {
  // Configuration
  configureHashtag(hashtag: string): Promise<void>
  
  // Content fetching
  fetchInstagramPosts(): Promise<InstagramPost[]>
  
  // Integration
  importInstagramPost(post: InstagramPost): Promise<Submission>
  
  // Event handling
  handleInstagramWebhook(payload: any): Promise<void>
}
```

**Integration Points**:
- PhotoWallService will coordinate with InstagramService
- Repository will add `source` field to submissions
- ModerationComponent will show source indicator
- AdminComponent will provide hashtag configuration UI

---

## Service Dependencies

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          PhotoWallService                                 │
│                            (Facade)                                       │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Repository  │  │   Storage   │  │   Realtime   │  │    Audit     │  │
│  │ (Data Access)│  │   Service   │  │   Service    │  │   Service    │  │
│  │              │  │  (Images)   │  │  (Events)    │  │   (Log)      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │                    AutoModeratorService                               │ │
│  │                    (Content Flagging)                                 │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  Phase 1 (local) implementations:                                        │
│  - PostgresRepository                                                     │
│  - FileStorageService                                                     │
│  - MemoryRealtimeService                                                  │
│  - AuditServiceImpl                                                       │
│  - AutoModeratorServiceImpl                                               │
│                                                                           │
│  Phase 2 (cloud) implementations (same interfaces):                      │
│  - SupabaseRepository                                                     │
│  - SupabaseStorageService                                                 │
│  - SupabaseRealtimeService                                                │
│  - AuditServiceImpl (same — repo-agnostic)                               │
│  - AutoModeratorServiceImpl (same — pure logic)                          │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## Phase Delivery Summary

| Service | Phase 1 (Local MVP) | Phase 2 (Cloud) | Phase 3 (Instagram) |
|---------|---------------------|-----------------|---------------------|
| Repository | PostgresRepository (interface) | SupabaseRepository (same interface) | Same as Phase 2 |
| StorageService | FileStorageService (interface) | SupabaseStorageService (same interface) | Same as Phase 2 |
| RealtimeService | MemoryRealtimeService (interface) | SupabaseRealtimeService (same interface) | Same as Phase 2 |
| AuditService | AuditServiceImpl (new — Update 01) | Same impl (repo-agnostic) | Same as Phase 2 |
| AutoModeratorService | AutoModeratorServiceImpl (new — Update 01) | Same impl (pure logic) | Same as Phase 2 |
| InstagramService | — | — | New: interface + implementation |
| Business Logic | All features (FR-01–FR-24c, 31 FRs + Update 01 + Update 02) | Same as Phase 1 (no changes) | Same + Instagram source handling |

---

## Error Handling Strategy

### Service-Level Error Handling

1. **Validation Errors**: Return structured error responses with field-level details
2. **Database Errors**: Log and return generic error to client, preserve details for debugging
3. **Storage Errors**: Retry with exponential backoff, fail gracefully with user-friendly message
4. **Realtime Errors**: Attempt reconnection, fall back to polling if unavailable
5. **Audit Errors**: Log audit failure but do not block the primary operation (audit is secondary)
6. **Auth Errors**: Check disabled account status and return appropriate error for disabled accounts

### Error Response Format

```typescript
interface ServiceError {
  code: string
  message: string
  details?: Record<string, any>
  timestamp: string
}
```

---

## Security Considerations

### Authentication & Authorization

- All moderation and admin operations require authentication
- Role-based access control (Moderator vs Admin)
- Session management with secure token handling
- Password hashing with bcrypt
- Disabled account check on login (Update 01 — FR-15a)
- Display Wall User role — view-only access to display wall route
- Audit service enforces append-only policy

### Input Validation

- File type and size validation for uploads
- Message length validation (configurable limit in characters or words)
- SQL injection prevention via parameterized queries
- XSS prevention via output encoding
- Auto-moderator flagging is advisory only (no automatic rejection)

### Rate Limiting

- Upload rate limiting to prevent abuse
- Authentication attempt limiting
- API rate limiting for production deployment