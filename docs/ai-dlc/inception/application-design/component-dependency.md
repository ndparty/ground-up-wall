# Component Dependencies — ground-up-wall (Updated for Update 02)

## Dependency Overview

This document describes the dependency relationships and communication patterns between components in the ground-up-wall system.

---

## Component Dependency Matrix

| Component | Depends On | Dependency Type | Communication Pattern |
|-----------|------------|-----------------|----------------------|
| UploadComponent | PhotoWallService | Direct | Synchronous API call |
| UploadComponent | StorageService | Indirect | Via PhotoWallService |
| DisplayComponent | PhotoWallService | Direct | Sync + Real-time |
| DisplayComponent | RealtimeService | Indirect | Via PhotoWallService |
| DisplayComponent | AuthComponent | Direct | Session check (auth-required access + train controls visibility) |
| ModerationComponent | RealtimeService | Indirect | Display override commands (via PhotoWallService) |
| ModerationComponent | PhotoWallService | Direct | Sync + Real-time |
| ModerationComponent | AuthComponent | Direct | Session management |
| ModerationComponent | AuditService | Indirect | Via PhotoWallService |
| AdminComponent | PhotoWallService | Direct | Synchronous API call |
| AdminComponent | AuthComponent | Direct | Session management |
| AdminComponent | AuditService | Direct | Read-only audit log view |
| AuthComponent | Repository | Direct | Data access |
| PhotoWallService | Repository | Direct | Data access |
| PhotoWallService | StorageService | Direct | Image operations |
| PhotoWallService | RealtimeService | Direct | Event publishing |
| PhotoWallService | AuditService | Direct | Audit logging |
| PhotoWallService | AutoModeratorService | Direct | Content flagging |
| Repository | Database | Direct | SQL queries |
| StorageService | Storage Backend | Direct | File operations |
| RealtimeService | Event Backend | Direct | Event distribution |
| AuditService | Repository | Direct | Audit log table access |
| AutoModeratorService | Repository | Direct | Word list from system_config |

---

## Dependency Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                            │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │    Upload    │  │   Display    │  │  Moderation  │  │    Admin     │ │
│  │  Component   │  │  Component   │  │  Component   │  │  Component   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │         │
│         │    ┌────────────┴─────────────────┴────────────────┘         │
│         │    │                                                          │
│         │    │    ┌───────────────────────────────────────────────┐    │
│         │    └───►│              AuthComponent                     │    │
│         │         │         (Session & Access Control)             │    │
│         │         └───────────────────────────────────────────────┘    │
│         │                          │                                   │
│         └──────────────────────────┼───────────────────────────────────┘
│                                    │
│                                    ▼
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                            SERVICE LAYER                                │
│                                                                         │
│         ┌───────────────────────────────────────────────────────────┐   │
│         │                   PhotoWallService                        │   │
│         │                      (Facade)                             │   │
│         └───────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│         ┌──────────┬───────────────┼────────────────┬──────────┐       │
│         │          │               │                │          │       │
│         ▼          ▼               ▼                ▼          ▼       │
│  ┌────────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌────────┐ │
│  │ Repository │ │ Storage  │ │   Realtime   │ │  Audit   │ │ Auto-  │ │
│  │ (Data)     │ │ Service  │ │   Service    │ │  Service │ │Moder-  │ │
│  │            │ │ (Images) │ │   (Events)   │ │          │ │ator    │ │
│  └──────┬─────┘ └────┬─────┘ └──────┬───────┘ └────┬─────┘ └────────┘ │
│         │            │              │              │                   │
└─────────┼────────────┼──────────────┼──────────────┼───────────────────┘
          │            │              │              │
          ▼            ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE LAYER                            │
│                                                                         │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐    │
│  │   Database   │         │    Storage   │         │    Events    │    │
│  │  (Postgres)  │         │   Backend    │         │   Backend    │    │
│  │              │         │              │         │              │    │
│  │  Tables:     │         │  Local:      │         │  Local:      │    │
│  │  submissions │         │  Filesystem  │         │  In-memory   │    │
│  │  users       │         │              │         │  emitter     │    │
│  │  audit_log   │         │  Prod:       │         │              │    │
│  │  system_config│        │  Supabase    │         │  Prod:       │    │
│  │              │         │              │         │  Supabase    │    │
│  └──────────────┘         └──────────────┘         └──────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Communication Patterns

### 1. Synchronous Request-Response

**Used by**: UploadComponent, ModerationComponent, AdminComponent

**Pattern**:
```
Component → PhotoWallService → Repository/StorageService → Response
```

**Examples**:
- Submit photo submission
- Approve/reject submission
- Edit submission content
- Create/disable/delete moderator account
- Update system parameters
- Change password

---

### 2. Real-time Publish-Subscribe

**Used by**: DisplayComponent, ModerationComponent

**Pattern**:
```
PhotoWallService → RealtimeService → Subscribed Components
```

**Events**:
- `submission_created` → ModerationComponent
- `submission_approved` → DisplayComponent, ModerationComponent
- `submission_rejected` → ModerationComponent
- `submission_edited` → DisplayComponent, ModerationComponent
- `submission_deleted` → DisplayComponent
- `train_paused` → DisplayComponent
- `train_resumed` → DisplayComponent
- `train_jump` → DisplayComponent
- `system_config_changed` → All components

---

### 3. Session Management

**Used by**: All authenticated components

**Pattern**:
```
Component → AuthComponent → Repository → Session Store
```

**Operations**:
- Login/logout
- Session validation
- Role checking
- Disabled account check (for FR-15a)
- Password changes

---

## Data Flow Diagrams

### Photo Submission Flow

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Upload    │────►│  PhotoWallService  │────►│ StorageService  │
│  Component   │     │                    │     │ (upload image)  │
└──────────────┘     └──────────────────┘     └─────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Repository  │
                     │ (create       │
                     │  submission)  │
                     └──────────────┘
                            │
                     ┌──────┴──────┐
                     ▼             ▼
              ┌──────────┐  ┌──────────────┐
              │  Audit   │  │  Realtime    │
              │  Service │  │  Service     │
              │ (log     │  │ (publish     │
              │  create) │  │  'created')  │
              └──────────┘  └──────┬───────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │  Moderation  │
                            │  Component   │
                            │ (update      │
                            │  queue)      │
                            └──────────────┘
```

### Moderation Flow (with Edit)

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Moderation  │────►│  PhotoWallService │────►│  Repository    │
│  Component   │     │                   │     │ (update status) │
└──────────────┘     └──────────────────┘     └─────────────────┘
                            │
                     ┌──────┴──────┐
                     ▼             ▼
              ┌──────────┐  ┌──────────────┐
              │  Audit   │  │  Realtime    │
              │  Service │  │  Service     │
              │ (log     │  │ (publish     │
              │  action) │  │  'approved'  │
              └──────────┘  └──────┬───────┘
                                   │
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
            ┌──────────────┐             ┌──────────────┐
            │   Display    │             │  Moderation  │
            │  Component   │             │  Component   │
            │ (add to      │             │ (remove from │
            │  train)      │             │  queue)      │
            └──────────────┘             └──────────────┘

Edit Flow (Extension):
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Moderation  │────►│  PhotoWallService │────►│  Repository     │
│  Component   │     │  editSubmission() │     │ (update content)│
└──────────────┘     └──────────────────┘     └──────────────────┘
                            │
                     ┌──────┴──────┐
                     ▼             ▼
              ┌──────────┐  ┌──────────────┐
              │  Audit   │  │  Realtime    │
              │  Service │  │  Service     │
              │ (log old │  │ (publish     │
              │  values) │  │  'edited')   │
              └──────────┘  └──────┬───────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │   Display    │
                            │  Component   │
                            │ (update cabin│
                            │  content)    │
                            └──────────────┘
```

### Display Wall Flow

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Display    │────►│  PhotoWallService │────►│  Repository    │
│  Component   │     │                   │     │ (get approved)  │
└──────────────┘     └──────────────────┘     └─────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │RealtimeService│
                     │ (subscribe to │
                     │  'approved',  │
                     │  'edited',    │
                     │  'deleted',   │
                     │  train cmds)  │
                     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Display    │
                     │  Component   │
                     │ (update      │
                     │  animation,  │
                     │  train       │
                     │  controls)   │
                     └──────────────┘
```

**Display override** (Update 02): Moderators/Admins can command blank screen, placeholder image, or resume from the moderation/admin panel. Commands are broadcast via RealtimeService (`display_blank`, `display_placeholder`, `display_resume`). Override state is persisted in the database so new Display Wall sessions also receive the correct state on load.

### Admin System Parameters & Audit Log Flow

```
System Parameters Flow:
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Admin     │────►│  PhotoWallService │────►│ Repository     │
│  Component   │     │  updateSysParam() │     │ (upsert config)│
└──────────────┘     └──────────────────┘     └─────────────────┘
                            │
                     ┌──────┴──────┐
                     ▼             ▼
              ┌──────────┐  ┌──────────────┐
              │  Audit   │  │  Realtime    │
              │  Service │  │  Service     │
              │ (log     │  │ (broadcast   │
              │  change) │  │  change)     │
              └──────────┘  └──────────────┘

Audit Log View Flow:
┌──────────────┐     ┌──────────────┐     ┌─────────────────┐
│    Admin     │────►│  AuditService│────►│ Repository      │
│  Component   │     │  getLog()    │     │ (query audit    │
│              │     │              │     │  with filters)  │
└──────────────┘     └──────────────┘     └─────────────────┘
```

---

## Environment-Specific Dependencies

### Phase 1 — Local Development (MVP)

| Component | Local Dependency | Configuration |
|-----------|------------------|---------------|
| Repository | PostgreSQL (localhost:5432) | `DATABASE_URL=postgresql://localhost/ground_up_wall` |
| StorageService | Filesystem (./uploads) | `STORAGE_PATH=./uploads` |
| RealtimeService | In-memory event emitter | `REALTIME_PROVIDER=memory` |
| AuditService | Local Postgres `audit_log` table | Same as Repository |
| AutoModeratorService | Local Postgres `system_config` table | Same as Repository |

### Phase 2 — Production (Deno Deploy + Supabase)

| Component | Production Dependency | Configuration |
|-----------|-----------------------|---------------|
| Repository | Supabase Postgres | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| StorageService | Supabase Storage | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| RealtimeService | Supabase Realtime | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| AuditService | Supabase Postgres `audit_log` table | Same as Repository |
| AutoModeratorService | Supabase Postgres `system_config` table | Same as Repository |

---

## Phase 3 Dependencies (Instagram Integration)

### New Dependencies

| Component | New Dependency | Purpose |
|-----------|----------------|---------|
| PhotoWallService | InstagramService | Fetch and import Instagram posts |
| AdminComponent | InstagramService | Configure hashtag settings |
| Repository | InstagramService | Store Instagram source data |
| ModerationComponent | InstagramService | Display source indicator |

## Data Model

### Submissions Table (Updated)

```typescript
interface Submission {
  id: string                    // UUID, primary key
  image_url: string             // Path to stored image (filesystem or Supabase Storage)
  message: string               // Configurable max length (characters or words)
  submitter_name: string        // Required
  social_handle: string | null  // Optional
  status: 'pending' | 'approved' | 'rejected'
  source: 'manual_upload'       // Extended in Phase 3 with 'instagram'
  source_metadata: object | null  // e.g. { instagram_post_id, instagram_username } in Phase 3
  created_at: timestamp
  approved_at: timestamp | null
  approved_by: string | null    // User ID of moderator who approved
  edited_by: string | null      // User ID of moderator who last edited (Update 01)
  edited_at: timestamp | null   // Timestamp of last edit (Update 01)
  edit_count: number            // Number of times edited (default 0)
  flagged_words: string[] | null // Words flagged by auto-moderator (Update 01)
  is_flagged: boolean           // Whether auto-moderator flagged this submission (Update 01)
}
```

### Users Table (Updated)

```typescript
interface User {
  id: string                    // UUID, primary key
  username: string              // Unique
  password_hash: string         // Bcrypt hash
  role: 'admin' | 'moderator' | 'display_wall'  // Update 02: added display_wall role
  disabled: boolean             // Whether account is disabled (Update 01, default false)
  disabled_at: timestamp | null // When account was disabled (Update 01)
  created_at: timestamp
  created_by: string | null     // Admin user ID who created this account
}
```

### Audit Log Table (New — Update 01)

```typescript
interface AuditEntry {
  id: string                    // UUID, primary key
  moderator_id: string          // User ID of the moderator/admin who performed the action
  action_type: 'approve' | 'reject' | 'delete' | 'edit' | 'submit' |
               'create_moderator' | 'disable_moderator' | 'delete_moderator' |
               'reset_password' | 'change_config' |
               'blank_display' | 'show_placeholder' | 'resume_display' | 'set_default_placeholder' |  // Update 02
               'create_display_wall_user' | 'disable_display_wall_user' | 'delete_display_wall_user'  // Update 02
  target_type: 'submission' | 'moderator' | 'display_wall_user' | 'system_config' | 'display_override'  // Update 02: added display_wall_user, display_override
  target_id: string             // ID of the affected resource
  old_value: string | null      // Previous value (for edits/config changes)
  new_value: string | null      // New value (for edits/config changes)
  timestamp: string             // UTC ISO 8601 with millisecond precision
}
// APPEND-ONLY — no update or delete operations permitted
```

### System Config Table (New — Update 01)

```typescript
interface SystemConfig {
  key: string                   // Primary key, e.g. 'train_dwell_time', 'message_prompt_text', 'message_length_limit', 'message_length_unit', 'auto_moderator_word_list', 'default_placeholder_image', 'display_override_state'
  value: string                 // Current value (stored as string, parsed by service)
  default_value: string         // Factory default for "Reset to default" feature
  updated_at: timestamp
  updated_by: string | null     // Admin user ID who last updated this setting
}
```

---

## Real-Time Mechanism (Local Development)

In Phase 1, the real-time service uses an in-memory event emitter within the Deno server process. This works well when the display wall and moderation panel are served from the same Deno instance.

**For cross-tab scenarios** (e.g., developer opens display wall and moderation panel in separate browser tabs):
- The Deno server maintains a single `EventEmitter` instance
- Server-Sent Events (SSE) push events to connected browser tabs
- Tabs subscribe via the `RealtimeService` interface, which translates in-memory events to SSE streams
- No WebSocket or Postgres `LISTEN/NOTIFY` needed in Phase 1

**For Phase 2**: Supabase Realtime (WebSocket-based) replaces the in-memory emitter — same interface, different transport.

**Fallback strategy**: If SSE is unavailable, the DisplayComponent polls `GET /api/submissions/approved` every 10 seconds, which still satisfies NFR-04 (30-second window).

**Train control events** (Update 01): The pause/play/jump commands are published via RealtimeService so all connected display wall tabs receive them simultaneously. Since state is not persisted across refresh, only currently connected tabs are affected.

**Display override events** (Update 02): The blank/placeholder/resume commands are published via RealtimeService so all connected display wall tabs receive them simultaneously. Override state is also persisted in the database, so new sessions check the current state on load.

---

## Phase 1 Abstraction Design

Phase 1 defines abstract interfaces for all infrastructure dependencies, with local-only implementations. This design ensures that Phase 2 (cloud deployment) requires only new implementations of the same interfaces — no code changes to business logic.

```typescript
// Defined in Phase 1 — implemented locally
interface Repository {
  // Submission operations
  createSubmission(data: SubmissionData): Promise<Submission>
  getPendingSubmissions(): Promise<Submission[]>
  getApprovedSubmissions(): Promise<Submission[]>
  updateSubmissionStatus(id: string, status: string): Promise<Submission>
  updateSubmissionContent(id: string, data: SubmissionEditData): Promise<Submission>  // Update 01
  deleteSubmission(id: string): Promise<void>

  // User operations
  authenticateUser(username: string, password: string): Promise<User | null>
  createUser(data: CreateUserData): Promise<User>
  changePassword(userId: string, current: string, newPassword: string): Promise<void>
  createModerator(username: string, password: string): Promise<void>
  listModerators(): Promise<Moderator[]>
  resetModeratorPassword(id: string, newPassword: string): Promise<void>
  disableModerator(id: string): Promise<void>            // Update 01
  enableModerator(id: string): Promise<void>             // Update 01
  deleteModerator(id: string): Promise<void>             // Update 01

  // System config operations (Update 01)
  getSystemConfig(key: string): Promise<SystemConfig | null>
  getAllSystemConfigs(): Promise<SystemConfig[]>
  upsertSystemConfig(key: string, value: string, updatedBy: string): Promise<void>
  resetSystemConfigToDefault(key: string): Promise<void>

  // Audit log operations (Update 01)
  createAuditEntry(entry: AuditEntryData): Promise<void>
  getAuditLog(filters: AuditFilter): Promise<AuditEntry[]>
}

interface StorageService {
  uploadImage(file: File, path: string): Promise<string>
  deleteImage(path: string): Promise<void>
}

interface RealtimeService {
  publish(event: string, data: any): void
  subscribe(event: string, callback: (data: any) => void): UnsubscribeFn
}

interface AuditService {                                   // New — Update 01
  logAction(action: AuditAction): Promise<void>
  getLog(filters: AuditFilter): Promise<AuditEntry[]>
}

interface AutoModeratorService {                           // New — Update 01
  checkMessage(message: string, wordList: string[]): FlagResult
  getFlaggedWords(message: string, wordList: string[]): string[]
}

// Phase 1 implementations (local)
class PostgresRepository implements Repository { /* local Postgres */ }
class FileStorageService implements StorageService { /* local filesystem */ }
class MemoryRealtimeService implements RealtimeService { /* in-memory events */ }
class AuditServiceImpl implements AuditService { /* uses Repository for audit_log table */ }
class AutoModeratorServiceImpl implements AutoModeratorService { /* string matching */ }

// Phase 2 implementations (cloud) — no business logic changes needed
class SupabaseRepository implements Repository { /* Supabase Postgres */ }
class SupabaseStorageService implements StorageService { /* Supabase Storage */ }
class SupabaseRealtimeService implements RealtimeService { /* Supabase Realtime */ }
```

### Instagram Integration Flow

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Instagram API│────►│ InstagramService │────►│ PhotoWallService│
│ (hashtag)    │     │                  │     │                 │
└──────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
                                                  ┌──────────────┐
                                                  │  Repository  │
                                                  │ (create      │
                                                  │  submission  │
                                                  │  with source)│
                                                  └──────────────┘
                                                          │
                                                          ▼
                                                  ┌──────────────┐
                                                  │RealtimeService│
                                                  │ (publish      │
                                                  │  'created')   │
                                                  └──────────────┘
                                                          │
                                                          ▼
                                                  ┌──────────────┐
                                                  │  Moderation  │
                                                  │  Component   │
                                                  │ (show source │
                                                  │  indicator)  │
                                                  └──────────────┘
```

---

## Dependency Injection Strategy

### Configuration-Based Injection

```typescript
// Environment detection
const env = Deno.env.get('DENO_DEPLOYMENT_ID') ? 'production' : 'local'

// Service registration
const services = {
  repository: env === 'production' 
    ? new SupabaseRepository(config.supabase)
    : new PostgresRepository(config.postgres),
  
  storage: env === 'production'
    ? new SupabaseStorageService(config.supabase)
    : new FileStorageService(config.filesystem),
  
  realtime: env === 'production'
    ? new SupabaseRealtimeService(config.supabase)
    : new MemoryRealtimeService(),

  audit: new AuditServiceImpl(repository),    // Works with both local and Supabase
  autoModerator: new AutoModeratorServiceImpl() // Pure logic, no environment dependency
}

// Service composition
const photoWallService = new PhotoWallService(
  services.repository,
  services.storage,
  services.realtime,
  services.audit,
  services.autoModerator
)
```

---

## Coupling Analysis

| Coupling Type | Assessment | Mitigation |
|---------------|------------|------------|
| Component → PhotoWallService | Tight (intentional) | Facade pattern simplifies client code |
| PhotoWallService → Repository | Loose | Interface-based, environment-aware |
| PhotoWallService → StorageService | Loose | Interface-based, environment-aware |
| PhotoWallService → RealtimeService | Loose | Interface-based, environment-aware |
| PhotoWallService → AuditService | Loose | Interface-based, environment-agnostic |
| PhotoWallService → AutoModeratorService | Loose | Pure logic, no environment dependency |
| Components → AuthComponent | Moderate | Session-based, stateless where possible |

---

## Error Propagation

### Error Flow

```
Infrastructure Layer (Database/Storage/Events)
    │
    ▼
Service Layer (Repository/StorageService/RealtimeService/AuditService)
    │
    ├─► Catch and wrap infrastructure errors
    ├─► Log with context
    └─► Return structured ServiceError
    │
    ▼
Facade (PhotoWallService)
    │
    ├─► Catch service errors
    ├─► Apply business logic for recovery
    └─► Return appropriate response to component
    │
    ▼
Presentation Layer (Components)
    │
    ├─► Display user-friendly error messages
    └─► Offer retry or alternative actions