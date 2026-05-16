# ground-up-wall

A photowall web application for events — users upload photos with short messages, displayed on a dynamic train-like wall. Built for the Singapore National Day ground-up party.

> **Status**: Inception phase — architecture and planning in progress.

## Source Code

The application code will live under `src/` once development begins.

Planned tech stack:
- **Runtime**: Deno Fresh
- **Hosting**: Deno Deploy
- **Database + Storage**: Supabase (Postgres + file storage)

## docs/ai-dlc/

This folder contains the shared AI-DLC (AI-Driven Development Lifecycle) artifacts — the requirements, user stories, and design documents produced during the inception phase. These are team-shared artifacts, referenced by each developer's personal SDD (Spec-Driven Development) session repository.

### Current Contents

```
docs/ai-dlc/
└── inception/
    ├── requirements/
    │   ├── requirements.md                         — 18 functional + 16 non-functional requirements
    │   └── requirement-verification-questions.md   — Clarifying questions and answers
    ├── user-stories/
    │   ├── personas.md                             — 3 personas (Participant, Moderator, Admin)
    │   ├── stories.md                              — 15 stories with Gherkin acceptance criteria
    │   └── traceability-matrix.md                  — FR/NFR to story mapping
    ├── application-design/
    │   ├── components.md                           — 9 components identified
    │   ├── component-methods.md                    — Method signatures per component
    │   ├── services.md                             — PhotoWallService facade + supporting services
    │   ├── component-dependency.md                 — Dependency matrix and data flow
    │   └── requirements-traceability.md            — 56 requirements mapped to components
    └── plans/
        ├── application-design-plan.md              — Application design phase plan
        ├── story-generation-plan.md                — Story generation phase plan
        └── user-stories-assessment.md              — User stories needs assessment
```

Future construction-phase artifacts will go under `docs/ai-dlc/construction/` and operations under `docs/ai-dlc/operations/`.