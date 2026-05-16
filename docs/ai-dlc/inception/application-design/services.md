# Services — ground-up-wall

## Service Layer Architecture

**Pattern**: Facade (Monolithic PhotoWallService)  
**Rationale**: Small one-day project — single coordinating service simplifies development and deployment

---

## PhotoWallService (Main Facade)

### Purpose

Central orchestrator for all photo wall operations. Coordinates between UI components, data access, storage, and real-time services.

### Responsibilities

1. **Submission Lifecycle Management**
   - Accept new submissions from UploadComponent
   - Coordinate image compression and storage
   - Create submission records in database
   - Publish events for real-time updates

2. **Moderation Workflow**
   - Provide pending submissions to ModerationComponent
   - Process approval/rejection decisions
   - Update submission status in database
   - Notify display wall of approved submissions

3. **Display Wall Operations**
   - Serve approved submissions to DisplayComponent
   - Maintain chronological ordering
   - Handle real-time updates for new approvals
   - Support cabin transition timing

4. **User Management**
   - Authenticate moderators and admins
   - Manage user sessions
   - Handle password changes
   - Enforce role-based access control

5. **Environment Coordination**
   - Detect execution environment (local vs production)
   - Route operations to appropriate backend services via abstracted interfaces
   - Handle configuration differences transparently via environment-based dependency injection

### Service Interfaces

```typescript
// Main service facade
interface PhotoWallService {
  // Submission operations
  submitSubmission(data: SubmissionData): Promise<Submission>
  getPendingSubmissions(): Promise<Submission[]>
  getApprovedSubmissions(): Promise<Submission[]>
  approveSubmission(id: string): Promise<Submission>
  rejectSubmission(id: string, reason?: string): Promise<Submission>
  deleteSubmission(id: string): Promise<void>
  
  // Real-time operations
  publishNewSubmission(submission: Submission): void
  subscribeToApproved(callback: (submission: Submission) => void): UnsubscribeFn
  
  // User operations
  authenticateUser(username: string, password: string): Promise<User | null>
  createUser(data: CreateUserData): Promise<User>
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>
  
  // Admin operations
  listModerators(): Promise<Moderator[]>
  createModerator(username: string, initialPassword: string): Promise<void>
  resetModeratorPassword(moderatorId: string, newPassword: string): Promise<void>
}
```

---

## Supporting Services

### Repository Service (Data Access)

**Purpose**: Abstracted data access layer for database operations

**Responsibilities**:
- CRUD operations for submissions
- User authentication and management
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
- Publish events (submission created, approved, rejected)
- Subscribe to events
- Handle reconnection and error recovery
- Environment-aware event distribution

**Implementation Strategy**:
- Local: In-memory event emitter
- Production: Supabase Realtime (websockets)
- Automatic environment detection

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
    ├─► Repository.createSubmission()
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
    └─► RealtimeService.publish('submission_approved')
            │
            ├─► DisplayComponent (adds to train)
            │
            └─► ModerationComponent (removes from queue)
```

### Display Flow

```
DisplayComponent
    │
    ├─► PhotoWallService.getApprovedSubmissions()
    │       │
    │       └─► Repository.getSubmissionsByStatus('approved')
    │
    └─► PhotoWallService.subscribeToApproved()
            │
            └─► RealtimeService.subscribe('submissions')
                    │
                    └─► On 'submission_approved' event:
                            Add to train animation
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
const services = {
  repository: new PostgresRepository(config.postgres),
  storage: new FileStorageService(config.filesystem),
  realtime: new MemoryRealtimeService()
}

const photoWallService = new PhotoWallService(
  services.repository,
  services.storage,
  services.realtime
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
const services = {
  repository: new SupabaseRepository(config.supabase),
  storage: new SupabaseStorageService(config.supabase),
  realtime: new SupabaseRealtimeService(config.supabase)
}
```

### Phase 3 — Instagram Integration (extends Phase 2 config)

```typescript
// Environment: production + instagram
const config = {
  database: {
    /* same as Phase 2 */
    provider: 'supabase',
    url: Deno.env.get('SUPABASE_URL'),
    key: Deno.env.get('SUPABASE_ANON_KEY')
  },
  storage: {
    /* same as Phase 2 */
    provider: 'supabase',
    bucket: 'submissions'
  },
  realtime: {
    /* same as Phase 2 */
    provider: 'supabase',
    url: Deno.env.get('SUPABASE_URL')
  },
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
┌─────────────────────────────────────────────────────────────┐
│                    PhotoWallService                         │
│                      (Facade)                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────┐ │
│  │    Repository    │  │  StorageService  │  │ Realtime  │ │
│  │   (Data Access)  │  │   (Images)       │  │  Service  │ │
│  └──────────────────┘  └──────────────────┘  └───────────┘ │
│                                                             │
│  Phase 1 (local) implementations:                           │
│  - PostgresRepository                                       │
│  - FileStorageService                                       │
│  - MemoryRealtimeService                                    │
│                                                             │
│  Phase 2 (cloud) implementations (same interfaces):         │
│  - SupabaseRepository                                       │
│  - SupabaseStorageService                                   │
│  - SupabaseRealtimeService                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Phase Delivery Summary

| Service | Phase 1 (Local MVP) | Phase 2 (Cloud) | Phase 3 (Instagram) |
|---------|---------------------|-----------------|---------------------|
| Repository | PostgresRepository (interface) | SupabaseRepository (same interface) | Same as Phase 2 |
| StorageService | FileStorageService (interface) | SupabaseStorageService (same interface) | Same as Phase 2 |
| RealtimeService | MemoryRealtimeService (interface) | SupabaseRealtimeService (same interface) | Same as Phase 2 |
| InstagramService | — | — | New: interface + implementation |
| Business Logic | All features (FR-01–FR-24) | Same as Phase 1 (no changes) | Same + Instagram source handling |

---

## Error Handling Strategy

### Service-Level Error Handling

1. **Validation Errors**: Return structured error responses with field-level details
2. **Database Errors**: Log and return generic error to client, preserve details for debugging
3. **Storage Errors**: Retry with exponential backoff, fail gracefully with user-friendly message
4. **Realtime Errors**: Attempt reconnection, fall back to polling if unavailable

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

### Input Validation

- File type and size validation for uploads
- Message length validation (max 50 characters)
- SQL injection prevention via parameterized queries
- XSS prevention via output encoding

### Rate Limiting

- Upload rate limiting to prevent abuse
- Authentication attempt limiting
- API rate limiting for production deployment