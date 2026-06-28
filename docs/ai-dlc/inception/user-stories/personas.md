# Personas — ground-up-wall

## Overview

Four roles: three follow a hierarchical permission model; the fourth (Display Wall User) is a
separate role for the TV display device.

- **Admin** inherits all Photo Moderator capabilities
- **Photo Moderator** inherits all Participant capabilities
- **Participant** is the base persona (upload only — no display wall viewing)
- **Display Wall User** is a separate TV account (view train display only; admin-created)

```
Admin → inherits → Photo Moderator → inherits → Participant (base, upload only)
Display Wall User (TV account — view train display only; admin-created; separate from inherit chain)
```

---

## Persona 1: Participant (Base)

| Attribute           | Description                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **Name**            | Jamie                                                                                                     |
| **Role**            | Event attendee / Community member                                                                         |
| **Technical Level** | Low — may not be tech-savvy                                                                               |
| **Device**          | Mobile phone (primary)                                                                                    |
| **Goal**            | Submit a photo and message for the National Day celebration                                               |
| **Frustration**     | Wants a quick, no-login submission process                                                                |
| **Key Behaviors**   | Scans QR code or opens short URL, uploads photo in under 3 taps, acknowledges privacy notice via checkbox |

**Capabilities:**

- Submit a photo with a short message and name
- View upload success page and posting guidelines disclaimer

---

## Persona 2: Photo Moderator

| Attribute           | Description                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**            | Sam                                                                                                                                                                        |
| **Role**            | Event organiser / Content moderator                                                                                                                                        |
| **Technical Level** | Low — non-technical volunteer                                                                                                                                              |
| **Device**          | Laptop or tablet                                                                                                                                                           |
| **Goal**            | Review and approve/reject photo submissions before they appear on the wall                                                                                                 |
| **Frustration**     | Needs a simple, intuitive interface — no training required                                                                                                                 |
| **Key Behaviors**   | Logs in via organiser login, reviews pending submissions, approves quality content, rejects inappropriate content, edits messages when needed, controls display wall state |

**Capabilities:**

- Everything Participant can do
- Log in via organiser login page
- View moderation queue of pending submissions
- Approve or reject submissions
- Edit submission content (message, name, social handle) before or after approval
- Delete previously approved submissions from the wall
- View display wall (for preview and control)
- Control train playback (pause/play/jump) on the display wall
- Command display override (blank screen / placeholder image / resume) from moderation panel
- Change own password

---

## Persona 3: Admin

| Attribute           | Description                                                                                                                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**            | Alex                                                                                                                                                                                                                                                 |
| **Role**            | Event lead / System administrator                                                                                                                                                                                                                    |
| **Technical Level** | Moderate — comfortable with basic system administration                                                                                                                                                                                              |
| **Device**          | Laptop                                                                                                                                                                                                                                               |
| **Goal**            | Manage moderator and Display Wall accounts, configure system parameters, and oversee the photowall system                                                                                                                                            |
| **Frustration**     | Wants to delegate moderation to volunteers without giving full admin access; needs visibility into who did what                                                                                                                                      |
| **Key Behaviors**   | Creates moderator and Display Wall accounts, monitors activity via audit log, disables accounts when needed, adjusts system settings (dwell time, prompt text, message length, filter words, default placeholder image), controls display wall state |

**Capabilities:**

- Everything Photo Moderator can do
- Create moderator accounts (username and initial password)
- Create Display Wall User accounts (username and initial password)
- Manage, disable, and delete moderator and Display Wall accounts
- Configure system parameters (train dwell time, message prompt text, message length limit and unit,
  auto-moderator word list, default placeholder image)
- View audit log with filtering
- Upload/replace default placeholder image for display override
- Initial admin credentials set by developer in backend

---

## Persona 4: Display Wall User

| Attribute           | Description                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **Name**            | Screen                                                                                                   |
| **Role**            | TV display device account                                                                                |
| **Technical Level** | N/A — account used by the TV/display device                                                              |
| **Device**          | Laptop/PC connected to TV via HDMI                                                                       |
| **Goal**            | Display the photo train animation on the TV screen during the event                                      |
| **Frustration**     | Needs to stay logged in for the event duration; re-login required if browser session expires             |
| **Key Behaviors**   | Logs in via organiser login page with Display Wall credentials, displays the train animation full-screen |

**Capabilities:**

- Log in to the display wall route
- View the photo train animation (full-screen display)

---

## Permission Matrix

| Feature                                             | Participant | Photo Moderator |    Admin     | Display Wall User |
| --------------------------------------------------- | :---------: | :-------------: | :----------: | :---------------: |
| Submit photo                                        |     ✅      |       ✅        |      ✅      |        ❌         |
| View display wall                                   |     ❌      |       ✅        |      ✅      |        ✅         |
| Log in to organiser panel                           |     ❌      |       ✅        |      ✅      |        ❌         |
| Log in to display wall route                        |     ❌      |       ✅        |      ✅      |        ✅         |
| View moderation queue                               |     ❌      |       ✅        |      ✅      |        ❌         |
| Approve/reject submissions                          |     ❌      |       ✅        |      ✅      |        ❌         |
| Edit submission content                             |     ❌      |       ✅        |      ✅      |        ❌         |
| Delete approved submissions                         |     ❌      |       ✅        |      ✅      |        ❌         |
| Control train playback (pause/play/jump)            |     ❌      |       ✅        |      ✅      |        ❌         |
| Command display override (blank/placeholder/resume) |     ❌      |       ✅        |      ✅      |        ❌         |
| Change own password                                 |     ❌      |       ✅        |      ✅      |        ❌         |
| Create moderator accounts                           |     ❌      |       ❌        |      ✅      |        ❌         |
| Create Display Wall accounts                        |     ❌      |       ❌        |      ✅      |        ❌         |
| Disable/delete moderator accounts                   |     ❌      |       ❌        |      ✅      |        ❌         |
| Disable/delete Display Wall accounts                |     ❌      |       ❌        |      ✅      |        ❌         |
| Configure system parameters                         |     ❌      |       ❌        |      ✅      |        ❌         |
| Upload default placeholder image                    |     ❌      |       ❌        |      ✅      |        ❌         |
| View audit log                                      |     ❌      |       ❌        |      ✅      |        ❌         |
| Initial admin credentials (dev-set)                 |     ❌      |       ❌        | ✅ (backend) |        ❌         |
