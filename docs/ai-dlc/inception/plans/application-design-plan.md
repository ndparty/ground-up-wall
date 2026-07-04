# Application Design Plan — ground-up-wall

## Plan Overview

**Phase**: INCEPTION — Application Design **Project**: ground-up-wall (Photowall Webapp for
Singapore National Day) **Source Documents**:

- `aidlc-docs/inception/requirements/requirements.md`
- `aidlc-docs/inception/user-stories/stories.md`

This plan will create the Technical Specification document with:

- High-level component identification and service layer design
- Component interfaces and responsibilities
- Requirements traceability matrix (FR/NFR → Technical Components)
- Phased implementation strategy

---

## Step 1: [x] Analyze Context

- [x] Review requirements document (24 Phase 1 FRs → later updated to 30 with Update 01)
- [x] Review user stories (15 stories → later updated to 22 with Update 01 stories)
- [x] Identify key business capabilities and functional areas
- [x] Determine design scope and complexity (Moderate - multiple components)

---

## Step 2: [x] Create Application Design Plan

- [x] Generate plan with checkboxes for application design
- [x] Focus on components, responsibilities, methods, business rules, and services
- [x] Each step and sub-step should have a checkbox

---

## Step 3: [x] Include Mandatory Design Artifacts in Plan

- [x] Generate `components.md` with component definitions and high-level responsibilities
- [x] Generate `component-methods.md` with method signatures
- [x] Generate `services.md` with service definitions and orchestration patterns
- [x] Generate `component-dependency.md` with dependency relationships and communication patterns
- [x] Generate `requirements-traceability.md` mapping FR/NFR to technical components
- [x] Validate design completeness and consistency

---

## Step 4: [x] Design Questions

Based on the requirements and user stories analysis, the following design decisions need
clarification:

### Component Architecture

**Question 1 - Component Granularity**: The system has 5 main features (Main Display, Upload,
Moderation, Admin, Change Password). How should components be organized?

- **Option A**: Feature-based components (UploadComponent, ModerationComponent, AdminComponent,
  DisplayComponent, AuthComponent)
- **Option B**: Layer-based components (Presentation Layer, Business Logic Layer, Data Access Layer)
- **Option C**: Hybrid approach (Feature components for UI, shared services for business logic and
  data access)

[Answer]: Option C

**Question 2 - Service Layer Design**: For the service orchestration, which pattern should be used?

- **Option A**: Facade pattern with a single PhotoWallService coordinating all operations
- **Option B**: Separate services per feature (UploadService, ModerationService, DisplayService,
  UserService)
- **Option C**: CQRS pattern with separate command and query services

[Answer]: Option A I'm thinking of having a monollth since this is a small project and will only be
used on that one day.

### Data Model

**Question 3 - Database Schema Approach**: For the submission data model, which approach is
preferred?

- **Option A**: Single `submissions` table with status field (pending/approved/rejected)
- **Option B**: Separate tables for `pending_submissions` and `approved_submissions`
- **Option C**: Event-sourcing approach with submission events table

[Answer]: Option A

### Real-time Updates

**Question 4 - Display Wall Real-time Mechanism**: For NFR-04 (new submissions appear within 30
seconds), which approach?

- **Option A**: Supabase Realtime (websockets) - push-based, immediate updates
- **Option B**: Polling every 15-30 seconds - simpler, more reliable
- **Option C**: Hybrid - websockets for moderation panel, polling for display wall

[Answer]: Option A but must also work with local postgres note that offline development and testing
should be possible event before pushing to external platforms like deno deploy and supabase

### Image Handling

**Question 5 - Image Processing Strategy**: For handling image uploads (R-01: storage limits), where
should processing occur?

- **Option A**: Client-side compression before upload (reduces bandwidth and storage)
- **Option B**: Server-side processing after upload (more control, higher bandwidth)
- **Option C**: Hybrid - client-side resize + server-side optimization

[Answer]: Option A Only compress just enough so that image still looks good on screen. Perhaps, this
can be further refined after feedback from actual testing later.

### Phase 2/3 Preparation

**Question 6 - Abstraction Layer Timing**: The requirements include Phase 2 (local dev flexibility)
and Phase 3 (Instagram integration). Should we:

- **Option A**: Implement abstraction layers upfront (repository pattern, storage abstraction,
  content source abstraction)
- **Option B**: Build Phase 1 directly against Supabase, refactor for Phase 2/3
- **Option C**: Implement core abstractions now, but keep Phase 1 implementation simple

[Answer]: I prefer the following approach: must work local first then, work with external platforms
(deno deploy and supabase) This way, we can ensure smooth development experience without being
blocked by external platform issues. instagram integration to be kept in the later phase (Phase 3)

---

## Step 5: [x] Store Application Design Plan

- [x] Save as `aidlc-docs/inception/plans/application-design-plan.md`
- [x] Include all [Answer]: tags for user input
- [x] Ensure plan covers all design aspects

---

## Step 6: [x] Request User Input

Please fill in the [Answer]: tags above with your design decisions. These decisions will guide the
technical specification creation.

**Instructions**:

1. Review each question and select your preferred option (A, B, or C)
2. Add any additional context or specific requirements in the [Answer]: field
3. If you have questions about any option, please ask before proceeding

---

## Step 7: [x] Collect Answers

- [x] Wait for user to provide answers to all questions
- [x] Review the document to ensure no [Answer]: tags are left blank

---

## Step 8: [x] Analyze Answers (MANDATORY)

**Analysis Complete** — All answers reviewed. No ambiguities detected.

### Design Decisions Summary:

| Question                  | Answer                       | Notes                                                                                                                                                                   |
| ------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1: Component Granularity | Option C (Hybrid)            | Feature components for UI, shared services for business logic                                                                                                           |
| Q2: Service Layer         | Option A (Facade)            | Single PhotoWallService (monolith for small one-day project)                                                                                                            |
| Q3: Database Schema       | Option A (Single table)      | `submissions` table with status field                                                                                                                                   |
| Q4: Real-time             | Option A (Supabase Realtime) | Must work locally with Postgres too; offline dev first                                                                                                                  |
| Q5: Image Processing      | Option A (Client-side)       | Light compression, refine after testing                                                                                                                                 |
| Q6: Abstraction Timing    | Local-first approach         | **Phase 1**: Local Deno app (local Postgres, filesystem, in-memory events). **Phase 2**: Cloud deployment (Deno Deploy + Supabase). **Phase 3**: Instagram integration. |

---

## Step 9: [x] Generate Application Design Artifacts

After answers are finalized, execute the approved plan to generate:

- [x] `aidlc-docs/inception/application-design/components.md`
- [x] `aidlc-docs/inception/application-design/component-methods.md`
- [x] `aidlc-docs/inception/application-design/services.md`
- [x] `aidlc-docs/inception/application-design/component-dependency.md`
- [x] `aidlc-docs/inception/application-design/requirements-traceability.md`

---

## Step 10: [x] Validate Design Completeness

- [x] All FRs are addressed by at least one component
- [x] All NFRs have corresponding technical strategies
- [x] Component interfaces are clearly defined
- [x] Service orchestration patterns are documented
- [x] Requirements traceability matrix is complete
