# User Stories — ground-up-wall

## Overview

**Organization**: Feature-based with 5 feature groups
**Format**: Gherkin (Given/When/Then) acceptance criteria
**Personas**: Participant (Jamie), Photo Moderator (Sam), Admin (Alex)
**NFRs**: Separate stories to avoid blocking main functions
**Ordering**: By user journey flow (Upload → Moderate → Display → Admin → Password)

---

## Feature 1: Upload Page

### US-01 — Submit a Photo (Participant)

**As a** Participant  
**I want** to submit a photo with a short message and my name  
**So that** my submission can appear on the National Day photowall

**Acceptance Criteria**:
```gherkin
Scenario: Successful photo submission
  Given I am on the upload page
  When I select a photo file
  And I enter a message of 50 characters or fewer
  And I enter my name
  And I tap the submit button
  Then I see a success confirmation message
  And my photo is added to the moderation queue

Scenario: Upload with optional social handle
  Given I am on the upload page
  When I fill in the optional social handle field
  And I submit the form
  Then my social handle is saved with the submission

Scenario: Message exceeds maximum length
  Given I am on the upload page
  When I enter a message longer than 50 characters
  Then I see a validation error "Message must be 50 characters or fewer"
  And the submit button remains disabled

Scenario: No file selected
  Given I am on the upload page
  When I tap submit without selecting a photo
  Then I see a validation error "Please select a photo"
  And the form is not submitted

Scenario: Invalid file type
  Given I am on the upload page
  When I select a non-image file (e.g., .pdf, .txt)
  Then I see a validation error "Please select an image file"
  And the file is rejected
```

### US-02 — Access Upload Page (Participant)

**As a** Participant  
**I want** to access the upload page via a short URL or QR code  
**So that** I can quickly submit a photo without typing a long address

**Acceptance Criteria**:
```gherkin
Scenario: Access via short URL
  Given I have the short URL for the event
  When I open it in my browser
  Then I see the upload form
  And I do not need to log in or register

Scenario: Access via QR code
  Given I scan the event QR code with my phone
  When the link opens
  Then I see the upload form
```

---

## Feature 2: Moderate Submitted Photos Page

### US-03 — Log In to Organiser Panel (Photo Moderator)

**As a** Photo Moderator  
**I want** to log in to the organiser panel  
**So that** I can review pending photo submissions

**Acceptance Criteria**:
```gherkin
Scenario: Successful login
  Given I am on the organiser login page
  When I enter my valid username and password
  And I submit the login form
  Then I am redirected to the moderation queue page

Scenario: Failed login
  Given I am on the organiser login page
  When I enter an invalid username or password
  Then I see an error "Invalid credentials"
  And I remain on the login page

Scenario: Access without login
  Given I am not logged in
  When I try to access the moderation queue URL directly
  Then I am redirected to the login page
```

### US-04 — View Pending Moderation Queue (Photo Moderator)

**As a** Photo Moderator  
**I want** to see a list of pending photo submissions  
**So that** I can review them before they appear on the wall

**Acceptance Criteria**:
```gherkin
Scenario: View pending submissions
  Given I am logged in as a Photo Moderator
  When I view the moderation queue
  Then I see a list of all unmoderated submissions
  And each submission shows the photo thumbnail, name, and message
  And submissions are ordered by submission time (oldest first)

Scenario: No pending submissions
  Given I am logged in as a Photo Moderator
  When there are no unmoderated submissions
  Then I see a message "No pending submissions"
```

### US-05 — Approve or Reject Submission (Photo Moderator)

**As a** Photo Moderator  
**I want** to approve or reject each pending submission  
**So that** appropriate content appears on the display wall

**Acceptance Criteria**:
```gherkin
Scenario: Approve a submission
  Given I am viewing a pending submission
  When I click "Approve"
  Then the submission is moved from the queue to approved
  And it becomes eligible for display on the wall
  And it should appear in the display rotation within 30 seconds

Scenario: Reject a submission
  Given I am viewing a pending submission
  When I click "Reject"
  Then the submission is removed from the queue
  And it is not displayed on the wall
  And the submitter is not notified

Scenario: Approve multiple submissions
  Given I have multiple pending submissions
  When I approve several in sequence
  Then each approved submission enters the display rotation
  And they appear in chronological order (oldest first)
```

### US-06 — Delete Approved Submission (Photo Moderator)

**As a** Photo Moderator  
**I want** to delete a previously approved submission  
**So that** I can remove content that should no longer be displayed

**Acceptance Criteria**:
```gherkin
Scenario: Delete an approved submission
  Given I am viewing the list of approved submissions
  When I click "Delete" on a submission
  Then the submission is removed from the display wall rotation
  And it is no longer visible on the wall

Scenario: Confirm deletion
  Given I click "Delete" on an approved submission
  When the confirmation dialog appears
  And I confirm the deletion
  Then the submission is permanently removed
```

---

## Feature 3: Main Display (Photo Train)

### US-07 — View Display Wall (Participant / Viewer)

**As a** Participant  
**I want** to see the photo train display wall  
**So that** I can view all approved submissions in the SMRT MRT train format

**Acceptance Criteria**:
```gherkin
Scenario: Display approved submissions
  Given there are approved submissions in the system
  When I view the display wall
  Then I see an SMRT MRT train with cabins scrolling right to left
  And each cabin displays a photo, message, and submitter name
  And the train focuses on one cabin at a time for approximately 15 seconds
  Then the train scrolls left to bring the next cabin into focus
  And the animation is smooth (targeting 60fps)

Scenario: Display empty state
  Given there are no approved submissions
  When I view the display wall
  Then I see a branded Singapore National Day waiting screen
  And the screen indicates submissions are coming soon

Scenario: Submissions displayed in chronological order
  Given there are multiple approved submissions
  When I view the display wall
  Then the cabins are ordered from oldest (left) to newest (right)
```

### US-08 — Automatic Wall Updates (System)

**As a** System  
**I want** to add newly approved submissions to the display rotation in real-time  
**So that** the wall stays current without manual refresh

**Acceptance Criteria**:
```gherkin
Scenario: New approval appears on wall
  Given the display wall is currently showing submissions
  When a new submission is approved by a moderator
  Then the new submission appears at the end of the train within 30 seconds
  And the display continues to animate smoothly without interruption

Scenario: Browser refresh recovers state
  Given the display wall was previously showing submissions
  When I refresh the browser page
  Then the display wall reloads with all approved submissions
  And the animation resumes from the first cabin
```

---

## Feature 4: Admin Page — Manage Users

### US-09 — Create Moderator Account (Admin)

**As an** Admin  
**I want** to create moderator accounts with username and initial password  
**So that** I can delegate moderation to trusted volunteers

**Acceptance Criteria**:
```gherkin
Scenario: Create a new moderator
  Given I am logged in as Admin
  When I navigate to the user management page
  And I enter a new username and initial password
  And I click "Create Moderator"
  Then the moderator account is created
  And the new moderator can log in with the credentials I set

Scenario: Duplicate username
  Given I am creating a moderator
  When I enter a username that already exists
  Then I see an error "Username already exists"
  And the account is not created

Scenario: Empty username or password
  Given I am creating a moderator
  When I leave the username or password field empty
  Then I see a validation error
  And the account is not created
```

### US-10 — View and Manage Moderators (Admin)

**As an** Admin  
**I want** to see a list of all moderator accounts  
**So that** I can manage who has moderation access

**Acceptance Criteria**:
```gherkin
Scenario: View moderator list
  Given I am logged in as Admin
  When I navigate to the user management page
  Then I see a list of all moderator accounts with usernames

Scenario: Reset moderator password
  Given I am viewing the moderator list
  When I select "Reset Password" for a moderator
  And I enter a new password
  Then the moderator's password is updated
```

---

## Feature 5: Change Password Page

### US-11 — Change Own Password (Photo Moderator & Admin)

**As a** Photo Moderator  
**I want** to change my own password  
**So that** I can maintain account security

**Acceptance Criteria**:
```gherkin
Scenario: Successful password change
  Given I am logged in as a Photo Moderator or Admin
  When I navigate to the change password page
  And I enter my current password
  And I enter a new password
  And I confirm the new password
  Then my password is updated
  And I see a success message

Scenario: Incorrect current password
  Given I am on the change password page
  When I enter an incorrect current password
  Then I see an error "Current password is incorrect"
  And the password is not changed

Scenario: Password confirmation mismatch
  Given I am on the change password page
  When the new password and confirmation do not match
  Then I see an error "Passwords do not match"
  And the password is not changed
```

---

## Non-Functional Requirement Stories

### US-NFR-01 — Mobile Responsiveness

**As a** Participant  
**I want** the upload form to work on my mobile phone  
**So that** I can submit a photo from my phone at the event

**Acceptance Criteria**:
```gherkin
Scenario: Upload form works on mobile
  Given I am using a mobile device
  When I access the upload page
  Then all form elements are visible and usable
  And I can complete the upload in 3 taps or fewer

Scenario: Display wall legible from distance
  Given the display wall is shown on a TV screen
  When viewed from across the room
  Then text is large enough to read (minimum 24px font for names, 18px for messages)
  And the photo occupies at least 60% of the cabin area
```

### US-NFR-02 — Display Wall Performance

**As a** Viewer  
**I want** the photo train animation to be smooth  
**So that** the display is pleasant to watch

**Acceptance Criteria**:
```gherkin
Scenario: Smooth animation
  Given the display wall is running on a modern laptop browser
  When the train animates between cabins
  Then the animation runs at or near 60fps
  And there is no visible jank or stutter

Scenario: Handles up to 200 submissions
  Given there are 200 approved submissions
  When the display wall loads
  Then the train loads all cabins within 5 seconds
  And the animation remains smooth
```

### US-NFR-03 — Security

**As an** Admin  
**I want** the admin panel to be protected from unauthorised access  
**So that** only approved organisers can moderate content

**Acceptance Criteria**:
```gherkin
Scenario: Admin panel not publicly accessible
  Given I am not logged in
  When I try to access any admin or moderation URL
  Then I am redirected to the login page
  And the main app URL does not expose admin routes

Scenario: Image upload validation
  Given I am on the upload page
  When I try to upload a file larger than 10MB
  Then I see an error "File too large"
  And the upload is rejected
  When I try to upload a non-image file type
  Then I see an error "Invalid file type"
  And the upload is rejected
```

### US-NFR-04 — Availability

**As an** Organiser  
**I want** the system to remain operational for the full event duration  
**So that** the photowall works throughout the party

**Acceptance Criteria**:
```gherkin
Scenario: System handles peak load
  Given the event is at peak time
  When 200 concurrent users are uploading photos
  Then all uploads complete within reasonable time
  And the display wall continues to function normally

Scenario: Supabase active during event week
  Given the event date is approaching
  When the Supabase project is not accessed for several days
  Then the project remains active (prevent free-tier pausing)
  And the system is operational on event day
```

---

## Story Summary

| ID | Feature | Title | Persona |
|:--:|---------|-------|:-------:|
| US-01 | Upload | Submit a Photo | Participant |
| US-02 | Upload | Access Upload Page | Participant |
| US-03 | Moderate | Log In to Organiser Panel | Photo Moderator |
| US-04 | Moderate | View Pending Queue | Photo Moderator |
| US-05 | Moderate | Approve or Reject | Photo Moderator |
| US-06 | Moderate | Delete Approved Submission | Photo Moderator |
| US-07 | Display | View Display Wall | Participant |
| US-08 | Display | Automatic Wall Updates | System |
| US-09 | Admin | Create Moderator Account | Admin |
| US-10 | Admin | View & Manage Moderators | Admin |
| US-11 | Password | Change Own Password | Photo Moderator & Admin |
| US-NFR-01 | NFR | Mobile Responsiveness | Participant |
| US-NFR-02 | NFR | Display Wall Performance | Viewer |
| US-NFR-03 | NFR | Security | Admin |
| US-NFR-04 | NFR | Availability | Organiser |