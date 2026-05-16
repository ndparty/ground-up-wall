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
   - Route operations to appropriate backend services
   - Handle configuration differences transparently

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

### Local Development

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
```

### Production (Deno Deploy + Supabase)

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
│  Environment-aware implementations:                         │
│  - PostgresRepository / SupabaseRepository                 │
│  - FileStorageService / SupabaseStorageService             │
│  - MemoryRealtimeService / SupabaseRealtimeService         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

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