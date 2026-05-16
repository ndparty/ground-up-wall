# Component Methods — ground-up-wall

## Method Signatures Reference

This document provides detailed method signatures for all components. Business rules are noted at a high level; detailed logic will be defined in Functional Design (CONSTRUCTION phase).

---

## UploadComponent Methods

### `submitPhoto(photo: File, message: string, name: string, socialHandle?: string): Promise<SubmissionResult>`

**Purpose**: Main entry point for photo submission

**Parameters**:
- `photo`: Image file (validated: JPEG/PNG, max 10MB)
- `message`: Short message (max 50 characters)
- `name`: Submitter's name (required)
- `socialHandle`: Optional social media handle

**Returns**: `SubmissionResult` with submission ID and status

**Business Rules**:
- Image must be compressed client-side before upload
- Form validation must pass before submission
- Submission enters "pending" status

---

### `validateForm(data: UploadData): ValidationResult`

**Purpose**: Validate upload form data

**Parameters**:
- `data`: UploadData object with photo, message, name, socialHandle

**Returns**: `ValidationResult` with isValid flag and error messages

**Validation Rules**:
- Photo: valid image file, under size limit
- Message: max 50 characters
- Name: non-empty string
- Social handle: optional, valid format if provided

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

**Purpose**: Subscribe to real-time updates for new approvals

**Parameters**:
- `callback`: Function called when new submission is approved

**Returns**: Unsubscribe function

**Business Rules**:
- Triggered when submission status changes to "approved"
- Automatically add to train animation
- Handle reconnection gracefully

---

### `renderTrain(submissions: Submission[]): void`

**Purpose**: Render the SMRT train animation

**Parameters**:
- `submissions`: Array of approved submissions

**Business Rules**:
- One cabin per submission
- Train scrolls right to left
- Focus on one cabin at a time (~15 seconds)
- Smooth transition animation

---

### `transitionToNextCabin(): void`

**Purpose**: Animate transition to next cabin

**Business Rules**:
- 15-second display per cabin
- Smooth scroll animation
- Loop back to first cabin when reaching end
- Maintain 60fps performance

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
- Set session with appropriate role
- Redirect to moderation panel on success

---

### `loadPendingSubmissions(): Promise<Submission[]>`

**Purpose**: Load moderation queue

**Returns**: Array of pending submissions

**Business Rules**:
- Only submissions with "pending" status
- Ordered by submission timestamp (newest first)
- Include full submission details for review

---

### `approveSubmission(id: string): Promise<void>`

**Purpose**: Approve a submission for display

**Parameters**:
- `id`: Submission ID

**Business Rules**:
- Change status to "approved"
- Set approval timestamp
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
- Remove from moderation queue

---

### `deleteApprovedSubmission(id: string): Promise<void>`

**Purpose**: Remove an approved submission from the wall

**Parameters**:
- `id`: Submission ID

**Business Rules**:
- Can only delete approved submissions
- Remove from display rotation immediately
- Trigger real-time update to display wall

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

## AdminComponent Methods

### `login(username: string, password: string): Promise<AuthResult>`

**Purpose**: Authenticate Admin user

**Parameters**:
- `username`: Admin username
- `password`: Admin password

**Returns**: `AuthResult` with admin user info and session token

**Business Rules**:
- Validate admin credentials
- Set session with admin role
- Redirect to admin panel on success

---

### `listModerators(): Promise<Moderator[]>`

**Purpose**: List all Photo Moderator accounts

**Returns**: Array of moderator user objects

**Business Rules**:
- Only accessible by Admin
- Include username, creation date, last login
- Exclude sensitive data (passwords)

---

### `createModerator(username: string, initialPassword: string): Promise<void>`

**Purpose**: Create new Photo Moderator account

**Parameters**:
- `username`: New moderator username
- `initialPassword`: Initial password (must be changed on first login)

**Business Rules**:
- Only accessible by Admin
- Username must be unique
- Password must meet complexity requirements
- Send credentials to moderator securely

---

### `resetModeratorPassword(moderatorId: string, newPassword: string): Promise<void>`

**Purpose**: Reset a moderator's password

**Parameters**:
- `moderatorId`: Moderator user ID
- `newPassword`: New password

**Business Rules**:
- Only accessible by Admin
- Invalidate existing sessions
- Require password change on next login

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
- Invalidate other sessions

---

### `getCurrentUser(): User | null`

**Purpose**: Get currently authenticated user

**Returns**: User object or null if not authenticated

---

### `isAuthenticated(): boolean`

**Purpose**: Check if user is authenticated

**Returns**: Boolean indicating authentication status

---

### `hasRole(role: 'moderator' | 'admin'): boolean`

**Purpose**: Check if current user has specific role

**Parameters**:
- `role`: Role to check

**Returns**: Boolean indicating role membership

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
- Create submission record with "pending" status
- Publish "submission_created" event

---

### `getPendingSubmissions(): Promise<Submission[]>`

**Purpose**: Get all pending submissions

**Returns**: Array of pending submissions

**Business Rules**:
- Only accessible by authenticated moderators/admins
- Ordered by submission timestamp (newest first)

---

### `getApprovedSubmissions(): Promise<Submission[]>`

**Purpose**: Get all approved submissions for display

**Returns**: Array of approved submissions

**Business Rules**:
- Ordered by approval timestamp (oldest first)
- Include all data needed for display

---

### `approveSubmission(id: string): Promise<Submission>`

**Purpose**: Approve a submission

**Parameters**:
- `id`: Submission ID

**Returns**: Updated Submission with "approved" status

**Business Rules**:
- Only accessible by authenticated moderators/admins
- Set status to "approved"
- Set approval timestamp
- Publish "submission_approved" event

---

### `rejectSubmission(id: string, reason?: string): Promise<Submission>`

**Purpose**: Reject a submission

**Parameters**:
- `id`: Submission ID
- `reason`: Optional rejection reason

**Returns**: Updated Submission with "rejected" status

**Business Rules**:
- Only accessible by authenticated moderators/admins
- Set status to "rejected"
- Store rejection reason if provided

---

### `deleteSubmission(id: string): Promise<void>`

**Purpose**: Delete a submission

**Parameters**:
- `id`: Submission ID

**Business Rules**:
- Only accessible by authenticated moderators/admins
- Delete submission record
- Delete associated image from storage
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

### `updateSubmissionStatus(id: string, status: SubmissionStatus): Promise<Submission>`

**Purpose**: Update submission status

**Parameters**:
- `id`: Submission ID
- `status`: New status

**Returns**: Updated Submission

**Business Rules**:
- Update status field
- Set appropriate timestamp (approval timestamp if approved)
- Return updated record

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

**Purpose**: Authenticate user

**Parameters**:
- `username`: Username
- `password`: Password (plain text, will be hashed for comparison)

**Returns**: User object if credentials valid, null otherwise

**Business Rules**:
- Hash password and compare with stored hash
- Return user with role if match
- Null if no match or user not found

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
- `channel`: Channel name (e.g., "submissions")
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