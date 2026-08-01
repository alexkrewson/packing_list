# Trip Planner — Integration Feature Spec

## Overview

Add third-party integrations to sync tasks and packing list items with popular external
apps. The goal is minimal user friction — users authenticate once and sync happens
automatically. This document describes the desired functionality; implementation details
should follow the existing codebase conventions.

---

# Next


# Later
## Task List Integrations

Sync the app's task list with popular to-do and project management platforms.


**Target providers:** Todoist, Google Tasks, Microsoft To Do, Notion, Linear, Asana

**Desired functionality:**
- User connects a provider once via OAuth 2.0 (standard authorization code flow)
- OAuth tokens stored securely server-side, refreshed automatically before expiry
- Two-way sync: local task changes push to the external platform, external changes pull
  into the app
- Field mapping: task title, completion status, and category should map to the closest
  equivalent fields on the external platform (e.g., category → list or project)
- Conflict resolution: last-write-wins based on timestamp comparison, with the option
  to prefer local or prefer external as a user setting
- Deletions propagated in both directions
- Sync mappings persisted so local records stay linked to their external counterparts
  across syncs

---

## Packing List Integrations

Sync packing list items with shopping and household list apps.

**Target providers:** OurGroceries, Amazon Alexa Shopping List

**Desired functionality:**
- Same OAuth/token storage pattern as task integrations (OurGroceries uses
  username/password instead of OAuth)
- Push packing items to the external list; pull back completion/check-off status
- When an item is marked as packed locally, reflect that on the external list
- Items linked to tasks (the existing task-packing link) should not break when synced

---

## Sync Behavior

- Sync triggers: on app open, on save of any task or packing item, and manually via a
  "Sync Now" control
- Each provider's sync direction should be configurable: push only, pull only, or
  two-way
- Sync activity and errors should be logged for debugging
- Conflicts and errors should be surfaced to the user in a non-intrusive way

---

## Settings UI

Add an Integrations section to the settings screen:
- List of available providers with connected/disconnected status
- Connect and disconnect controls per provider
- Sync direction selector per provider
- Manual sync trigger per provider
- Last synced timestamp per provider

---

## Open Questions for Implementation

- Should category → external list/project mapping be automatic (create if missing) or
  require the user to manually map categories to existing lists?
- Should packing items be removed from the external list when marked as packed, or left
  for the user to manage there?
- Should Notion integration target a user-specified existing database or always create
  a new one?