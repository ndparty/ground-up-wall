# Story Generation Plan — ground-up-wall

## Plan Overview
**Phase**: INCEPTION — User Stories
**Project**: ground-up-wall (Photowall Webapp for Singapore National Day)
**Source Document**: `aidlc-docs/inception/requirements/requirements.md`

This plan will convert the requirements document (18 FRs, 16 NFRs, 3 DRs) into user stories organized by personas, with acceptance criteria for each story.

---

## Step 1: [x] Define User Personas

**Question 1 - Persona Depth**:
How detailed should the personas be?

- [Answer]: Simple personas only I think. 
Participant 
    - can view the photowall page
    - can submit photo in another page
Photo Moderator 
    - everything the participant can do plus the following:
    - can login (organizer login) - admins and moderators are part of organizers
    - approves/rejects photo
    - can change his/her own password
Admin 
    - everything the moderator can do plus the following:
    - can create initial username and password of moderators via the admin page
    - admin credentials to be set by the developer in the backend manually


**Question 2 - Additional Personas**:
The requirements suggest three user types — are there any others we should consider? (E.g., system administrator for setup/teardown, event MC who might need display control)

- [Answer]: refer to Question 1. We might need to adjust requirements document to reflect the personas to stay coherent.

---

## Step 2: [x] Choose Story Breakdown Approach

The requirements document already defines a **Phased Delivery Plan**:
1. **Phase 1 - MVP**: Manual upload + moderation + display wall
2. **Phase 2 - Local Development**: Environment-based config + abstraction layers
3. **Phase 3 - Instagram Integration**: Hashtag-based content aggregation

**Question 3 - Story Organization**:
How would you like the stories organized?

**Option A: Epic-Based (Recommended)** — Stories grouped under epics that map to the 3 phases
**Option B: Feature-Based** — Stories organized around system features (Upload, Admin, Display, Backend)
**Option C: Persona-Based** — Stories grouped by user type (Participant, Organiser, Viewer)
**Option D: Hybrid (Epic → Feature → Stories)** — Epics by phase, features within each epic

- [Answer]: Option B: Feature-Based
    - Main Display (photo train)
    - Upload page
    - Moderate Submitted Photos page
    - Admin page - manage users
    - Change password page

**Question 4 - Story Granularity**:
What level of detail do you want per story?

**Fine-grained** — 1 story per requirement (e.g., "As a participant, I can upload a photo with a short message" — approximately 18-20 stories for Phase 1)
**Medium** — 1 story per feature group (e.g., "As a participant, I can submit a photo and message" covering upload form, validation, success message — approximately 8-10 stories for Phase 1)
**Coarse** — 1 story per component (e.g., "Build the participant upload app" covering all upload-related requirements — approximately 3-4 stories for Phase 1)

- [Answer]: For each feature (page), have a story for each persona (e.g. what can the persona do in that page?)
Since admin can do whatever moderator can do
and moderator can do whatever participant can do,
perhaps, can simplify the persona to be used in the page (feature).
For example, in the main display page, you only need to take care of participant persona since there's no special privilege for moderator or admin in that page.

---

## Step 3: [x] Determine Acceptance Criteria Format

**Question 5 - Acceptance Criteria Style**:
What format should acceptance criteria follow?

**Gherkin (Given/When/Then)** — Structured, test-friendly, good for automation
**Bullet-point checklist** — Simpler, readable, good for manual review
**Hybrid** — Gherkin for complex flows, bullets for simple requirements

- [Answer]: Gherkin

**Question 6 - Non-Functional Requirements**:
Should NFRs (performance, security, accessibility) be embedded within relevant user stories or documented separately?

- [Answer]: separator user story if required so it can be tested separately and not block the main functions.

---

## Step 4: [x] Determine Story Ordering

**Question 7 - Story Priority / Ordering**:
Within each epic/phase, how should stories be ordered?

**By user journey flow** — Upload first (participants need to submit before organisers can moderate, before the wall can display)
**By development dependency** — Backend/API first, then UI components
**By business value** — Display wall first (most visible at the event), then upload, then moderation

- [Answer]: By user journey flow

---

## Step 5: [x] Determine Output Artifacts

**Question 8 - Additional Artifacts**:
Beyond `stories.md` and `personas.md`, would you like any additional output?

- A **story map** showing the relationship between stories
- A **traceability matrix** mapping stories back to requirements (FRs/NFRs)
- A **glossary** of domain terms (e.g., cabin, train, moderation queue)

- [Answer]: traceability matrix

---

## Step 6: [x] Finalize and Execute Plan — IN PROGRESS

Once all [Answer] tags above are filled in, I will generate the personas and stories.

---

## Artifacts to Generate
- [x] `aidlc-docs/inception/user-stories/personas.md` — User archetypes and characteristics
- [x] `aidlc-docs/inception/user-stories/stories.md` — Complete user stories with acceptance criteria
- [x] `aidlc-docs/inception/user-stories/traceability-matrix.md` — FR/NFR to story mapping
