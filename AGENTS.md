# AGENTS.md

## Purpose

This file defines the working rules for AI coding agents operating in this repository.

The Product Requirements Document is the product source of truth:

`docs/PRD.md`

Before planning or implementing any feature, read the relevant sections of `docs/PRD.md`.

If implementation decisions conflict with the PRD, stop and report the conflict instead of silently changing the product requirements.

---

## Project

**Name:** Task Assignment Management System

The application is an internal web-based task and assignment management system that replaces the existing spreadsheet as the primary user interface while keeping Google Sheets as the MVP database.

Primary goals include:

- Manage active assignments.
- Track consultant, client, programmer, status, and deadline.
- Preserve historical tasks.
- Search completed work.
- Track changes.
- Support multiple screenshot/image attachments.
- Keep infrastructure simple and low-cost.

Do not add major product features that are not defined in the PRD without user approval.

---

## Architecture

Target architecture:

```text
GitHub Pages
    |
    v
React Frontend
    |
    v
Google Apps Script API
    |
    +---- Google Sheets
    |
    +---- Google Drive
```

Development assistance:

```text
OpenCode CLI
    |
    v
9router
    |
    v
Selected AI model
```

9router is development infrastructure only. It is not part of the production application.

---

## Technology Stack

### Frontend

- React
- Vite
- TypeScript
- Tailwind CSS

### Backend/API

- Google Apps Script

### Database

- Google Sheets

### Attachment Storage

- Google Drive

### Hosting

- GitHub Pages

### Source Control

- Git / GitHub

Do not introduce a separate Node.js backend, database server, cloud backend, authentication platform, or other production infrastructure unless explicitly approved.

---

## Development Strategy

Development MUST be performed phase-by-phase.

The phases are defined in `docs/PRD.md`.

Current initial phase:

`Phase 0 - Project Foundation`

Do not implement future phases while working on the current phase.

At the end of each phase:

1. Validate the implementation.
2. Run available lint checks.
3. Run available type checks.
4. Run the production build.
5. Report changed files.
6. Report commands executed.
7. Report validation results.
8. Report known issues or assumptions.
9. STOP.
10. Wait for explicit approval before starting the next phase.

Never automatically continue into the next phase.

---

## Phase Scope Discipline

Before coding:

1. Read `docs/PRD.md`.
2. Identify the currently requested phase.
3. Inspect the existing repository.
4. Determine the minimum implementation required for that phase.
5. Reuse existing code and dependencies where appropriate.

During implementation:

- Stay inside the requested phase.
- Avoid speculative features.
- Avoid premature abstractions.
- Avoid implementing future backend functionality while working on frontend-only phases.
- Avoid large unrelated refactors.
- Do not rewrite working code without a clear reason.
- Prefer simple maintainable solutions.

If something is useful but belongs to a future phase, mention it in the final report instead of implementing it.

---

## Design Skills

Project-local OpenCode skills are available under:

`.opencode/skills/`

Relevant skills include:

- `designing-frontend-interfaces`
- `designing-user-experience`

Use these skills when relevant to UI/UX work.

Do not load or apply unrelated skills unnecessarily.

For visual implementation, prioritize:

- Clear information hierarchy.
- Dense but readable task-management UI.
- Fast scanning of status and deadlines.
- Consistent spacing.
- Accessible interactions.
- Responsive behavior.
- Practical internal-tool UX.

Avoid unnecessary decorative UI and excessive animation.

The existing spreadsheet workflow described in the PRD should inform the information density and task-management behavior, but the website does not need to visually imitate Google Sheets.

---

## UI Component Strategy

Prefer reusable components.

Before building a custom UI primitive, check whether an existing project component or selected component library already solves the problem.

Likely reusable primitives include:

- Button
- Input
- Textarea
- Select
- Dialog
- Dropdown
- Badge
- Table
- Card
- Tabs
- Tooltip
- Date picker
- Form controls

Avoid duplicating components with nearly identical behavior.

Do not add large UI libraries simply for one small component.

---

## TypeScript Rules

Use TypeScript for application code.

Prefer explicit domain types for important application entities.

Examples:

```ts
type TaskStatus = "Open" | "Assign" | "Done";
type TaskType = "Bugs" | "Improvements";
```

Create reusable interfaces/types for entities such as:

- Task
- TaskHistory
- Attachment
- Consultant
- Programmer
- Client

Avoid `any` unless there is a justified reason.

Keep API response types explicit once the API layer is introduced.

---

## Data Rules

Google Sheets is the MVP source of persistent application data.

Do not hardcode production master data in frontend source code.

During mock-data phases, mock data is allowed and should be clearly isolated so it can later be replaced by the real data layer.

`Remaining Days` is calculated data and should not become the authoritative stored value.

Task IDs must be stable and unique.

Historical/completed tasks must not disappear when they leave the active workflow.

Archive is preferred over hard delete.

---

## API Rules

The frontend must access persistent data through the Google Apps Script API layer.

Do not directly expose privileged Google APIs or credentials to the browser.

Keep API access behind a dedicated frontend service/data-access layer so mock data can be replaced without rewriting UI components.

UI components should not contain raw persistence logic.

Recommended separation:

```text
UI Components
    |
    v
Hooks / Application Logic
    |
    v
Service / Data Access Layer
    |
    v
Google Apps Script API
```

---

## Attachment Rules

Images/files belong in Google Drive.

Google Sheets stores attachment metadata only.

Do not store image binary/base64 payloads permanently in Google Sheets.

One task may contain multiple attachments.

Attachment implementation belongs to its PRD-defined phase. Do not implement Drive upload early.

---

## Security Rules

NEVER commit secrets.

Never place these values in frontend source code:

- Google credentials
- Service account credentials
- Private API keys
- 9router credentials
- AI provider API keys
- Secret tokens

Do not commit `.env` files containing secrets.

Provide `.env.example` when environment configuration is required.

Anything shipped through GitHub Pages must be treated as publicly readable.

Validate and sanitize external input when the backend phase is implemented.

Validate attachment MIME type and size when attachment upload is implemented.

---

## GitHub Pages Compatibility

The frontend must remain deployable to GitHub Pages.

Consider GitHub Pages base paths when configuring:

- Vite
- Asset URLs
- Client-side routing

Do not assume the site is hosted at `/`.

Production builds must work under the repository base path.

Avoid server-side rendering requirements.

---

## Code Organization

Keep responsibilities separated.

Recommended direction:

```text
src/
├── components/
├── features/
├── hooks/
├── layouts/
├── lib/
├── pages/
├── services/
├── types/
└── data/
```

This is guidance, not a requirement to create every directory immediately.

Only create directories when they are actually needed.

Do not create empty architecture purely for appearance.

---

## Naming

Use clear, predictable names.

Prefer:

```text
TaskTable.tsx
TaskDetail.tsx
TaskForm.tsx
StatusBadge.tsx
DeadlineBadge.tsx
taskService.ts
task.types.ts
```

Avoid vague names such as:

```text
Utils2.ts
HelperNew.ts
ComponentFinal.tsx
Temp.tsx
```

---

## Comments and Documentation

Prefer self-explanatory code.

Comments should explain WHY something exists, not restate obvious code behavior.

Update documentation when:

- Setup steps change.
- Architecture changes.
- Deployment changes.
- Environment variables change.
- Important development assumptions change.

Do not modify product requirements in `docs/PRD.md` merely to match an implementation shortcut.

---

## Dependencies

Before adding a dependency:

1. Check whether the project already provides the capability.
2. Determine whether the dependency materially reduces complexity.
3. Avoid packages for trivial functionality.
4. Prefer mature and actively maintained packages.
5. Avoid overlapping libraries that solve the same problem.

Do not perform broad dependency upgrades unless required by the current phase.

---

## Testing and Validation

For each implementation phase, use the validation commands available in the project.

Expected checks once configured:

```bash
npm run lint
npm run typecheck
npm run build
```

If tests exist:

```bash
npm test
```

Do not claim a command succeeded unless it was actually executed successfully.

If a command cannot run, report the reason.

Warnings and errors must be distinguished clearly.

---

## Error Handling

Do not silently swallow errors.

UI should eventually provide appropriate:

- Loading states.
- Empty states.
- Error states.
- Retry behavior where appropriate.

Do not expose sensitive backend details to end users.

Detailed diagnostics may be logged for development when safe.

---

## Accessibility

Interactive elements should be keyboard accessible.

Use semantic HTML where possible.

Inputs require labels.

Do not communicate important state using color alone.

Dialogs/modals must support sensible focus behavior.

Images used as content require appropriate alternative text where applicable.

---

## Responsive Behavior

Desktop/laptop is the primary target.

The application must remain usable on tablet and mobile.

Do not force the full desktop task table onto narrow mobile screens if a responsive alternative provides better usability.

---

## Performance

This is an internal productivity application.

Prioritize:

1. Correctness.
2. Maintainability.
3. Usability.
4. Reasonable performance.

Avoid premature optimization.

However, avoid obvious problems such as:

- Repeated unnecessary API requests.
- Rendering huge lists without pagination when data grows.
- Shipping unnecessarily large dependencies.
- Re-fetching unchanged master data repeatedly.

---

## Existing Data Migration

Existing spreadsheet data must be preserved.

Migration belongs to its PRD-defined phase.

Before migration:

- Back up the source spreadsheet.
- Never destructively modify the only copy of historical data.
- Validate row counts.
- Validate date conversion.
- Spot-check representative records.

Do not perform production migration automatically without explicit approval.

---

## Agent Behavior

When receiving an implementation request:

### First

- Read this file.
- Read the relevant PRD section.
- Inspect existing code.
- Inspect package configuration.
- Check current git status when appropriate.

### Then

Briefly state the implementation plan before making substantial changes.

### While Working

- Keep scope tight.
- Reuse existing code.
- Avoid unrelated cleanup.
- Avoid speculative architecture.
- Do not silently change requirements.

### Before Finishing

Run the relevant validation commands.

### Final Report

Use this format:

```text
Phase:
<phase name>

Implemented:
- ...

Files changed:
- ...

Validation:
- command -> result

Assumptions:
- ...

Deferred / Future phase:
- ...

Known issues:
- ...
```

Then STOP and wait for approval.

---

## Prohibited Agent Behavior

Do not:

- Implement multiple phases without permission.
- Replace the agreed stack without permission.
- Add a backend server when Apps Script is sufficient.
- Add authentication during MVP unless requested.
- Add AI features to the production app unless requested.
- Put secrets into frontend code.
- Hard-delete historical production data casually.
- Perform destructive migration automatically.
- Rewrite the entire repository to solve a local problem.
- Generate unnecessary files or abstractions.
- Claim validation was performed when it was not.
- Continue to the next phase automatically.

---

## Current Development State

At the initial repository setup:

- PRD exists.
- OpenCode project skills exist.
- OpenCode configuration exists.
- Application implementation has not yet started.

Current target:

`Phase 0 - Project Foundation`

Phase 0 should establish the frontend project and development foundation only.

Do not implement Google Sheets integration, Apps Script APIs, historical tracking, Google Drive uploads, or production data migration during Phase 0.
