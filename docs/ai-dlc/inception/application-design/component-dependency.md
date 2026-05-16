# Component Dependencies — ground-up-wall

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
| ModerationComponent | PhotoWallService | Direct | Sync + Real-time |
| ModerationComponent | AuthComponent | Direct | Session management |
| AdminComponent | PhotoWallService | Direct | Synchronous API call |
| AdminComponent | AuthComponent | Direct | Session management |
| AuthComponent | Repository | Direct | Data access |
| PhotoWallService | Repository | Direct | Data access |
| PhotoWallService | StorageService | Direct | Image operations |
| PhotoWallService | RealtimeService | Direct | Event publishing |
| Repository | Database | Direct | SQL queries |
| StorageService | Storage Backend | Direct | File operations |
| RealtimeService | Event Backend | Direct | Event distribution |

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
│         ┌──────────────────────────┼──────────────────────────┐         │
│         │                          │                          │         │
│         ▼                          ▼                          ▼         │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐    │
│  │  Repository  │         │StorageService│         │RealtimeService│   │
│  │ (Data Access)│         │  (Images)    │         │  (Events)    │    │
│  └──────┬───────┘         └──────┬───────┘         └──────┬───────┘    │
│         │                        │                        │            │
└─────────┼────────────────────────┼────────────────────────┼────────────┘
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE LAYER                            │
│                                                                         │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐    │
│  │   Database   │         │    Storage   │         │    Events    │    │
│  │  (Postgres)  │         │   Backend    │         │   Backend    │    │
│  │              │         │              │         │              │    │
│  │  Local:      │         │  Local:      │         │  Local:      │    │
│  │  Postgres    │         │  Filesystem  │         │  In-memory   │    │
│  │              │         │              │         │              │    │
│  │  Prod:       │         │  Prod:       │         │  Prod:       │    │
│  │  Supabase    │         │  Supabase    │         │  Supabase    │    │
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
- Create moderator account
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
- Password changes

---

## Data Flow Diagrams

### Photo Submission Flow

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Upload    │────►│  PhotoWallService │────►│ StorageService  │
│  Component   │     │                  │     │ (upload image)  │
└──────────────┘     └──────────────────┘     └─────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Repository  │
                     │ (create      │
                     │  submission) │
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
                     │ (update      │
                     │  queue)      │
                     └──────────────┘
```

### Moderation Flow

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Moderation  │────►│  PhotoWallService │────►│  Repository    │
│  Component   │     │                  │     │ (update status) │
└──────────────┘     └──────────────────┘     └─────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │RealtimeService│
                     │ (publish      │
                     │  'approved')  │
                     └──────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
     ┌──────────────┐             ┌──────────────┐
     │   Display    │             │  Moderation  │
     │  Component   │             │  Component   │
     │ (add to      │             │ (remove from │
     │  train)      │             │  queue)      │
     └──────────────┘             └──────────────┘
```

### Display Wall Flow

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Display    │────►│  PhotoWallService │────►│  Repository    │
│  Component   │     │                  │     │ (get approved)  │
└──────────────┘     └──────────────────┘     └─────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │RealtimeService│
                     │ (subscribe to │
                     │  'approved')  │
                     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Display    │
                     │  Component   │
                     │ (update      │
                     │  animation)  │
                     └──────────────┘
```

---

## Environment-Specific Dependencies

### Phase 1 — Local Development (MVP)

| Component | Local Dependency | Configuration |
|-----------|------------------|---------------|
| Repository | PostgreSQL (localhost:5432) | `DATABASE_URL=postgresql://localhost/ground_up_wall` |
| StorageService | Filesystem (./uploads) | `STORAGE_PATH=./uploads` |
| RealtimeService | In-memory event emitter | `REALTIME_PROVIDER=memory` |

### Phase 2 — Production (Deno Deploy + Supabase)

| Component | Production Dependency | Configuration |
|-----------|-----------------------|---------------|
| Repository | Supabase Postgres | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| StorageService | Supabase Storage | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| RealtimeService | Supabase Realtime | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |

---

## Phase 3 Dependencies (Instagram Integration)

### New Dependencies

| Component | New Dependency | Purpose |
|-----------|----------------|---------|
| PhotoWallService | InstagramService | Fetch and import Instagram posts |
| AdminComponent | InstagramService | Configure hashtag settings |
| Repository | InstagramService | Store Instagram source data |
| ModerationComponent | InstagramService | Display source indicator |

### Phase 1 Abstraction Design

Phase 1 defines abstract interfaces for all infrastructure dependencies, with local-only implementations. This design ensures that Phase 2 (cloud deployment) requires only new implementations of the same interfaces — no code changes to business logic.

```typescript
// Defined in Phase 1 — implemented locally
interface Repository {
  createSubmission(data: SubmissionData): Promise<Submission>
  getPendingSubmissions(): Promise<Submission[]>
  getApprovedSubmissions(): Promise<Submission[]>
  updateSubmissionStatus(id: string, status: string): Promise<Submission>
  deleteSubmission(id: string): Promise<void>
  authenticateUser(username: string, password: string): Promise<User | null>
  createUser(data: CreateUserData): Promise<User>
  changePassword(userId: string, current: string, newPassword: string): Promise<void>
  createModerator(username: string, password: string): Promise<void>
  listModerators(): Promise<Moderator[]>
  resetModeratorPassword(id: string, newPassword: string): Promise<void>
}

interface StorageService {
  uploadImage(file: File, path: string): Promise<string>
  deleteImage(path: string): Promise<void>
}

interface RealtimeService {
  publish(event: string, data: any): void
  subscribe(event: string, callback: (data: any) => void): UnsubscribeFn
}

// Phase 1 implementations (local)
class PostgresRepository implements Repository { /* local Postgres */ }
class FileStorageService implements StorageService { /* local filesystem */ }
class MemoryRealtimeService implements RealtimeService { /* in-memory events */ }

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
    : new MemoryRealtimeService()
}

// Service composition
const photoWallService = new PhotoWallService(
  services.repository,
  services.storage,
  services.realtime
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
| Components → AuthComponent | Moderate | Session-based, stateless where possible |

---

## Error Propagation

### Error Flow

```
Infrastructure Layer (Database/Storage/Events)
    │
    ▼
Service Layer (Repository/StorageService/RealtimeService)
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