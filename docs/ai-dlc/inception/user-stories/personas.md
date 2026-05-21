# Personas — ground-up-wall

## Overview

Three personas with a hierarchical permission model:
- **Admin** inherits all Photo Moderator capabilities
- **Photo Moderator** inherits all Participant capabilities
- **Participant** is the base persona

```
Admin → inherits → Photo Moderator → inherits → Participant
```

---

## Persona 1: Participant (Base)

| Attribute | Description |
|-----------|-------------|
| **Name** | Jamie |
| **Role** | Event attendee / Community member |
| **Technical Level** | Low — may not be tech-savvy |
| **Device** | Mobile phone (primary) |
| **Goal** | Submit a photo and message for the National Day celebration, view the photowall |
| **Frustration** | Wants a quick, no-login submission process |
| **Key Behaviors** | Scans QR code or opens short URL, uploads photo in under 3 taps, returns to view the wall |

**Capabilities:**
- View the display wall (photo train)
- Submit a photo with a short message and name

---

## Persona 2: Photo Moderator

| Attribute | Description |
|-----------|-------------|
| **Name** | Sam |
| **Role** | Event organiser / Content moderator |
| **Technical Level** | Low — non-technical volunteer |
| **Device** | Laptop or tablet |
| **Goal** | Review and approve/reject photo submissions before they appear on the wall |
| **Frustration** | Needs a simple, intuitive interface — no training required |
| **Key Behaviors** | Logs in via organiser login, reviews pending submissions, approves quality content, rejects inappropriate content, edits messages when needed |

**Capabilities:**
- Everything Participant can do
- Log in via organiser login page
- View moderation queue of pending submissions
- Approve or reject submissions
- Edit submission content (message, name, social handle) before or after approval
- Delete previously approved submissions from the wall
- Control train playback (pause/play/jump) on the display wall
- Change own password

---

## Persona 3: Admin

| Attribute | Description |
|-----------|-------------|
| **Name** | Alex |
| **Role** | Event lead / System administrator |
| **Technical Level** | Moderate — comfortable with basic system administration |
| **Device** | Laptop |
| **Goal** | Manage moderator accounts, configure system parameters, and oversee the photowall system |
| **Frustration** | Wants to delegate moderation to volunteers without giving full admin access; needs visibility into who did what |
| **Key Behaviors** | Creates moderator accounts, monitors activity via audit log, disables accounts when needed, adjusts system settings (dwell time, prompt text, filter words), controls display wall access |

**Capabilities:**
- Everything Photo Moderator can do
- Create moderator accounts (username and initial password)
- Manage, disable, and delete moderator accounts
- Configure system parameters (train dwell time, message prompt text, auto-moderator word list)
- View audit log with filtering
- Toggle display wall visibility
- Initial admin credentials set by developer in backend

---

## Permission Matrix

| Feature | Participant | Photo Moderator | Admin |
|---------|:-----------:|:---------------:|:-----:|
| View display wall | ✅ | ✅ | ✅ |
| Submit photo | ✅ | ✅ | ✅ |
| Log in to organiser panel | ❌ | ✅ | ✅ |
| View moderation queue | ❌ | ✅ | ✅ |
| Approve/reject submissions | ❌ | ✅ | ✅ |
| Edit submission content | ❌ | ✅ | ✅ |
| Delete approved submissions | ❌ | ✅ | ✅ |
| Control train playback (pause/play/jump) | ❌ | ✅ | ✅ |
| Toggle display wall visibility | ❌ | ❌ | ✅ |
| Change own password | ❌ | ✅ | ✅ |
| Create moderator accounts | ❌ | ❌ | ✅ |
| Disable/delete moderator accounts | ❌ | ❌ | ✅ |
| Configure system parameters | ❌ | ❌ | ✅ |
| View audit log | ❌ | ❌ | ✅ |
| Initial admin credentials (dev-set) | ❌ | ❌ | ✅ (backend) |
