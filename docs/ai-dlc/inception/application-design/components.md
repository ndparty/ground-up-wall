# Components — ground-up-wall

## Architecture Overview

**Architectural Style**: Hybrid (UI components + shared services)  
**Service Pattern**: Facade (monolithic PhotoWallService)  
**Database**: Single `submissions` table with status field  
**Real-time**: Environment-adaptive (local events / Supabase Realtime)

---

## Component Catalog

### 1. UploadComponent

**Purpose**: Handles photo submission from participants (no login required)

**Responsibilities**:
- Display upload form (photo, message, name, optional social handle)
- Client-side image compression before upload
- Form validation (file type, size, message length)
- Submit to backend via PhotoWallService
- Display success confirmation

**Interfaces**:
- `submitPhoto(photo: File, message: string, name: string, socialHandle?: string): Promise<SubmissionResult>`
- `validateForm(data: UploadData): ValidationResult`
- `compressImage(file: File, maxWidth: number, quality: number): Promise<Blob>`

**UI Routes**: `/upload`, `/` (home redirects to upload)

---

### 2. DisplayComponent

**Purpose**: Renders the SMRT train animation on the TV screen

**Responsibilities**:
- Fetch approved submissions (initial load)
- Subscribe to real-time updates for new approvals
- Render train animation (scrolling left, cabin-by-cabin focus)
- Manage cabin transition timing (~15 seconds per cabin)
- Display branded waiting screen when no submissions exist
- Maintain 60fps animation performance

**Interfaces**:
- `loadApprovedSubmissions(): Promise<Submission[]>`
- `subscribeToUpdates(callback: (submission: Submission) => void): UnsubscribeFn`
- `renderTrain(submissions: Submission[]): void`
- `transitionToNextCabin(): void`

**UI Routes**: `/display`, `/wall`

---

### 3. ModerationComponent

**Purpose**: Interface for Photo Moderators to review and approve/reject submissions

**Responsibilities**:
- Display login form for Photo Moderators/Admins
- Show moderation queue (pending submissions)
- Preview submission (photo + message + name + social handle)
- Approve or reject each submission
- Delete previously approved submissions
- Real-time updates when new submissions arrive

**Interfaces**:
- `login(username: string, password: string): Promise<AuthResult>`
- `loadPendingSubmissions(): Promise<Submission[]>`
- `approveSubmission(id: string): Promise<void>`
- `rejectSubmission(id: string, reason?: string): Promise<void>`
- `deleteApprovedSubmission(id: string): Promise<void>`
- `subscribeToNewSubmissions(callback: (submission: Submission) => void): UnsubscribeFn`

**UI Routes**: `/moderate`, `/moderator/login`

---

### 4. AdminComponent

**Purpose**: Admin-only interface for managing Photo Moderator accounts

**Responsibilities**:
- Display login form for Admins
- List existing Photo Moderator accounts
- Create new Photo Moderator accounts (username + initial password)
- Reset passwords for existing moderators
- Access to Instagram hashtag configuration (Phase 3)

**Interfaces**:
- `login(username: string, password: string): Promise<AuthResult>`
- `listModerators(): Promise<Moderator[]>`
- `createModerator(username: string, initialPassword: string): Promise<void>`
- `resetModeratorPassword(moderatorId: string, newPassword: string): Promise<void>`
- `configureInstagramHashtag(hashtag: string): Promise<void>` (Phase 3)

**UI Routes**: `/admin`, `/admin/login`

---

### 5. AuthComponent

**Purpose**: Shared authentication functionality for Moderators and Admins

**Responsibilities**:
- Handle login/logout
- Session management
- Password change functionality
- Role-based access control (Moderator vs Admin)
- Protected route guards

**Interfaces**:
- `login(username: string, password: string): Promise<AuthResult>`
- `logout(): Promise<void>`
- `changePassword(currentPassword: string, newPassword: string): Promise<void>`
- `getCurrentUser(): User | null`
- `isAuthenticated(): boolean`
- `hasRole(role: 'moderator' | 'admin'): boolean`

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

**Interfaces**:
- `submitSubmission(data: SubmissionData): Promise<Submission>`
- `getPendingSubmissions(): Promise<Submission[]>`
- `getApprovedSubmissions(): Promise<Submission[]>`
- `approveSubmission(id: string): Promise<Submission>`
- `rejectSubmission(id: string, reason?: string): Promise<Submission>`
- `deleteSubmission(id: string): Promise<void>`
- `publishNewSubmission(submission: Submission): void`
- `subscribeToApproved(callback: (submission: Submission) => void): UnsubscribeFn`

---

### 7. Repository (Data Access Layer)

**Purpose**: Abstracted data access for submissions, users, and configuration

**Responsibilities**:
- CRUD operations for submissions
- User authentication and management
- Environment-aware data access (local Postgres vs Supabase)
- Query optimization for display wall (chronological ordering)

**Interfaces**:
- `createSubmission(data: SubmissionData): Promise<Submission>`
- `getSubmissionsByStatus(status: 'pending' | 'approved' | 'rejected'): Promise<Submission[]>`
- `updateSubmissionStatus(id: string, status: SubmissionStatus): Promise<Submission>`
- `deleteSubmission(id: string): Promise<void>`
- `authenticateUser(username: string, password: string): Promise<User | null>`
- `createUser(data: CreateUserData): Promise<User>`
- `updateUserPassword(userId: string, newPassword: string): Promise<void>`

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
- Event types: submission_created, submission_approved, submission_rejected
- Automatic reconnection and error handling

**Interfaces**:
- `subscribe(channel: string, callback: (payload: any) => void): UnsubscribeFn`
- `publish(channel: string, payload: any): Promise<void>`
- `onSubmissionApproved(callback: (submission: Submission) => void): UnsubscribeFn`
- `onSubmissionCreated(callback: (submission: Submission) => void): UnsubscribeFn`

---

## Component Interaction Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                          │
├─────────────┬─────────────┬──────────────┬────────────┬─────────┤
│    Upload   │   Display   │  Moderation  │    Admin   │  Auth   │
│  Component  │  Component  │   Component  │  Component │Component│
└──────┬──────┴──────┬──────┴──────┬───────┴──────┬─────┴────┬────┘
       │             │             │              │          │
       └─────────────┴─────────────┴──────────────┴──────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER (Facade)                       │
│                   PhotoWallService                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Repository  │  │StorageService│  │   RealtimeService    │  │
│  │   (Data)     │  │  (Images)    │  │    (Events)          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  Local: Postgres + Filesystem    │    Production: Supabase     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 3 Extension Points

| Component | Phase 1 | Phase 3 Extension |
|-----------|---------|-------------------|
| PhotoWallService | Manual submissions only | Add `fetchInstagramPosts()` method |
| Repository | `submissions` table | Add `source` field (manual/instagram) |
| ModerationComponent | Manual review | Show source indicator |
| AdminComponent | User management | Add Instagram hashtag config UI |
| RealtimeService | Local/Supabase events | Add Instagram webhook handling |