# Duties & dates
<!-- kurz: Duty rosters, work assignments and work hours – plus club dates with replies. -->

## What is this module for? {#wofuer}

Members sign up for duties in the member app (bar, till, setting up) and report their work hours. On the tablet they clock in and out for bar duty. In the admin area you see who has done how many hours, confirm reports and have missing hours billed in the fee run. There are also club dates (e.g. Christmas party, general meeting) that members answer with “I’m coming” or “I’m not coming”.

The module works on its own. Without the Members module the same target applies to everyone; families, age, fee types and billing through the fee run need it.

## Setting up {#einrichten}

1. **Settings › Modules:** switch “Duties & dates” on. With “Demo” you can try the module with made-up data first.
2. **Assign the permission:** under Settings › Users & permissions, give whoever should manage the module the permission “Duties & dates”.
3. **Set the target and billing:** “Settings” page, cards “Target” and “Billing” (see below). The suggested values are fine to start with; the setup assistant takes you there too.
4. **Member app:** under Member app › Sections, “Duties” must be ticked for the members. They then see the section straight away.
5. **Create the first entries:** a duty roster for your next event, a work assignment or a club date (see below).

## Admin area {#verwaltung}

The admin area has five tabs at the top: **Overview**, **Duty rosters**, **Shifts**, **Hours** and **Settings**. The number of hour reports you still have to confirm is shown on the “Hours” tab and in the menu.

### “Overview” tab {#arbeitseinsatz}

![The overview: key figures at the top, below them the list of all members with target, completed and missing hours.](bild: seite=arbeitseinsatz)

The overview shows who has already reached their target of work hours. Missing hours are added in the fee run as a “Work hours” item once the year is over.

#### Key figures and year

At the top you choose the **year** (the current one, the next one and two past ones). Next to it is the period, marked “closed” for years that are over. The four tiles show **Total target**, **completed**, **still missing** and **equals** (the money value of the missing hours at the hourly rate you set). If there are hour reports to confirm, a yellow notice above links to the “Hours” tab.

![The tiles with target, completed and missing hours.](bild: seite=arbeitseinsatz; ziel=.kpis)

#### List

The list has the columns **Member**, **Target**, **completed**, **Progress** (bar), **reported** (hours still waiting for confirmation), **missing** (with a tick once everything is done) and **Amount**. Below each name it says how the target arises, e.g. “Default” or “exempt”.

- **Search:** the “Search name” field.
- **Filter:** “Still missing”, “Done”, “Exempt” or “All”, each with the number of entries.
- **Families:** if “Count families together” is on, a family is one row (tag “Family · 3”). Use “+” to unfold the family members. The target of all of them counts together; completed is whatever anyone in the family has done.
- **Excel:** the “Excel” button at the top right downloads the list with all members and with the families as a spreadsheet.

![An unfolded family: each family member with their own target.](bild: seite=arbeitseinsatz; klick=#awSeg [data-f="alle"]; klick2=[data-tg]; fuelle=#awQ::Hofmann; ziel=#awTbl)

#### Mandatory hours for individual members

The “Mandatory hours …” button at the end of a row opens a window for exceptions. At the top it shows the current target and the reason. Below you choose:

- **Automatic:** the target follows the rules under “Settings”.
- **Custom target:** a different target in hours, for the selected year only, with a reason.
- **Exempt:** the member has no target, even if active. You can enter an end date (“Exempt until”, empty = permanently) and a reason (e.g. board office). Hours they do are still recorded; missing hours are not billed.

![The “Mandatory hours” window with the three options.](bild: seite=arbeitseinsatz; klick=[data-tgt]; ziel=dialog)

### “Duty rosters” tab {#aw-plaene}

![The “Duty rosters” tab with the upcoming events and their progress.](bild: seite=aw-plaene)

A duty roster belongs to an event over one or more days, e.g. summer festival or mulled-wine evening. It consists of **shifts** with a task, a time and a number of helpers. Members sign up in the app themselves.

#### List of duty rosters

Each card shows the first day on the left, next to it the title, period, location, number of shifts and “x of y helpers” with a bar. Tags show **Draft** (still invisible to members), **does not count as work hours** and **in Sales** (transferred as an event). “Open” takes you into the roster. The “Upcoming” and “Past” chips switch the list.

#### New duty roster

“+ New duty roster” opens a window with **Event**, **First day**, **Last day**, **Location** and **Info for all helpers** (everyone sees it in the app). Two ticks decide whether the roster **counts towards work hours** and whether it is **published**. Without the tick at “Published” the roster stays a draft until you release it.

![The “New duty roster” window.](bild: seite=aw-plaene; klick=#plNew; ziel=dialog)

#### Inside a roster: “Shifts” tab

A roster opens in its own view. At the top, “← All duty rosters” takes you back; on the right are the actions **Edit**, **Print**, **Excel** and, as long as the roster is a draft, **Publish**. Each day has a card with its shifts and a “+ Shift” button.

![A duty roster with the shifts for each day: time, task, how full it is and the helpers signed up.](bild: seite=aw-plaene; klick=[data-po])

Each shift shows the time, the task, how full it is (“✓ full”, “3 missing” or “5 on board”), the helpers signed up (with a profile photo if there is one; guests are marked “· Guest”) and free places as dashed tags. The buttons on the right:

- **Helpers:** add or remove people.
- **Edit:** change the shift.
- **Credit hours:** appears once the shift is over and counts.

**Creating or editing a shift.** The window has **Day**, **From**, **To (optional)**, **What** (with suggestions such as bar, till, grill, setting up), **Helpers needed** (empty = any number), **Info about the shift** and the ticks “Counts towards work hours” and “Active”. Without an end time it reads “from 4 pm”; an end before the start counts as after midnight (23:30–02:00). “Then add another shift” carries straight on with the next one. “Delete shift …” asks in the same window and says how many helpers are removed with it.

![The “New shift” window.](bild: seite=aw-plaene; klick=[data-po]; klick2=[data-add]; ziel=dialog)

**Signing up helpers.** The window shows all active members to tick (with a filter) and below it “Helpers without membership”, e.g. from a neighbouring club: enter a name, “Add”. Members normally sign up themselves; here you can also remove people after the 24-hour deadline has passed.

![The “Helpers” window of a shift with members and helpers without membership.](bild: seite=aw-plaene; klick=[data-po]; klick2=[data-sh]; ziel=dialog)

**Credit hours.** For past shifts you book the same duration as confirmed hours for all ticked helpers at once. The duration is pre-filled from the shift time. Anyone who already has hours for the shift is skipped. Guests get no hours.

![The “Credit hours” window for a past shift.](bild: seite=aw-plaene; klick=#plSeg [data-f="vergangen"]; klick2=[data-po]; klick3=[data-sc]; ziel=dialog)

**Editing or deleting a roster.** “Edit” at the top opens the same window as when creating one. It contains “Delete duty roster …”; all shifts and sign-ups are then deleted with it (with a confirmation).

**Printing.** Produces a notice for the board: one table per day with When, What, Helpers (free places as lines to write on), Status and Info. The print window opens from the admin area; allow pop-ups for it.

#### Inside a roster: “Pass on” tab

![The “Pass on” tab: copy as a template and transfer to Sales.](bild: seite=aw-plaene; tab=weitergeben; tabkey=detail_dienstplan; klick=[data-po])

- **Copy as template …:** creates the same shifts on new days, e.g. for next year. You give a name and the first day (pre-filled: one year later, the year in the name counts up). Helpers are not copied; the new roster starts as a draft.
- **Transfer to sales …:** creates the roster as an event in Sales (all items at the normal price) so drinks and food can be booked there. The card only appears if Sales is active, you have the “Events” permission there and the roster has not been transferred yet. Afterwards the “in Sales” tag shows the name of the event.

![The “Copy as template” window.](bild: seite=aw-plaene; tab=weitergeben; tabkey=detail_dienstplan; klick=[data-po]; klick2=#plCopy; ziel=dialog)

> Copy last year’s roster instead of building a new one. Afterwards you only need to check the days and number of helpers and click “Publish”.

### “Shifts” tab {#aw-einsaetze}

![The “Shifts” tab with permanent assignments, upcoming work assignments and club dates.](bild: seite=aw-einsaetze)

This is where everything that does not belong to a duty roster lives: work assignments (e.g. spring clean), bar duty and club dates. The “Upcoming” and “Past” chips switch the list. Each row shows the date, the title with its **type** as a tag, the time, the location and, for work assignments, the number of places and the helpers signed up by name.

The buttons on the right of each row:

- **Helpers** (work assignments): add or remove members, as with a roster.
- **Replies** (club dates): the attendance list, see below.
- **Credit hours:** for past assignments, as with a roster.
- **Deactivate / Activate:** a deactivated entry is kept (grey, tag “deactivated”), but does not appear on the tablet or in the app, and no reminders go out. Handy as a draft or when something is cancelled.
- **Edit:** the window with all the details.

#### Permanent (all year)

The top card holds assignments without a fixed date, above all **bar duty**, which is already set up. As long as it is active, people choose it on the tablet when clocking in. It does not appear in the app (no sign-up, no reminders). No helpers are entered here; the hours come from clocking in.

![The “Permanent (all year)” card with bar duty.](bild: seite=aw-einsaetze; ziel=#main .card)

#### New assignment

“+ New shift” opens the window. The **type** decides which fields appear:

| Type | What it is for |
|---|---|
| Work assignment | Working together on one day, e.g. trimming the hedge |
| Bar duty | A duty at the bar |
| Duty | A single duty |
| Other | Anything else that counts hours |
| Date | A club date with replies (never counts towards work hours) |

The other fields: **Title**, **Date**, **From** and **To**, **Location / meeting point**, **Helpers needed** (empty = any number), **Note** (e.g. “bring work gloves”) and the **Active** tick. With **Permanent** (not for club dates) it becomes an all-year assignment like bar duty; date and time are dropped. With **Repeat weekly** you create several weeks in one go.

![The “New assignment” window.](bild: seite=aw-einsaetze; klick=#evNew; ziel=dialog)

An existing assignment can be changed with “Edit” or removed with “Delete shift …”; the confirmation says how many helpers disappear with it.

#### Club dates with replies

Choose **Date** as the type, e.g. for a Christmas party or general meeting. The fields change: **Reply by** (empty = until the date) and **Maximum number of people** (empty = any). With the tick **Invite members straight away by notification and ask for a reply** (only when creating) all members with the app get a message at once.

![The window of a club date with reply deadline and maximum.](bild: seite=aw-einsaetze; klick=.aw-ev:has([data-eva2]) [data-eve]; ziel=dialog)

#### Attendance list

The row of a club date shows, instead of helpers, the number of **acceptances** (with people), **declines** and those **without a reply**. The **Replies** button opens the attendance list:

![The attendance list of a club date.](bild: seite=aw-einsaetze; klick=[data-eva2]; ziel=dialog)

- Three blocks: **Coming**, **Not coming**, **No reply yet**, alphabetical by surname, with the member’s note.
- You can **reply for a member**, e.g. after a phone call: choose “coming”, “not coming” or “no reply”; for “coming” a field takes the number of people. Every change is saved straight away.
- **Excel** downloads the list as a spreadsheet (e.g. for the caterer).
- **Remind those without a reply** sends everyone without a reply a notification. The button is grey if everyone has replied or the date is deactivated.

> In the app members only see the number of acceptances, never names. Only the admin area sees declines.

### “Hours” tab {#aw-stunden}

![The “Hours” tab with the reports waiting for confirmation.](bild: seite=aw-stunden)

All hours that someone has reported or clocked end up here. Three chips filter: **To confirm** (with a number), **Clocked in** (running right now) and **All** (for the selected year).

#### List

The columns: **Member** (with the activity below), **Date** (with the time for clocked hours), **Activity**, **Source** (admin area, app or tablet), **Status** and **Duration**. The status is “to confirm”, “confirmed”, “rejected” or “running”.

#### Confirming and rejecting

Under “To confirm” every row is ticked (“all” at the top toggles them all). **Confirm selected** adds the hours to the member’s total; with **Reject selected** you give a reason, which the member sees in the app. Untick single rows you still want to check.

#### Editing an entry

“Change” at the end of a row opens a window with **Date**, **Duration in hours** and **Activity**. It contains “Delete entry …” (with a confirmation; the hours then no longer count). A running entry shows **Clock out** instead; only after that can it be edited or deleted.

![The “Edit entry” window.](bild: seite=aw-stunden; klick=[data-ed]; ziel=dialog)

#### Adding hours

The “Add hours …” button books hours for several members at once: **Date**, **Duration in hours**, optionally an **assignment**, **What was done?** and the members to tick (with a filter). Added hours count as confirmed immediately.

![The “Add hours” window.](bild: seite=aw-stunden; klick=#esAdd; ziel=dialog)

### “Settings” tab {#aw-einstellungen}

The page consists of six cards. Each card has its own “Save”, which writes only its own fields.

#### Target

![The “Target” card.](bild: seite=aw-einstellungen; ziel=[data-set="soll"])

- **Hours per member and year:** the default for everyone.
- **From age / Up to age** (0 = no limit): anyone younger or older has no target.
- **Count families together:** the family’s target counts as one, billed to the main payer.
- **Passive and honorary members are exempt.**
- **Pro rata when joining or leaving during the year:** by full months.

You set a target per fee type under Members › Fees, and exceptions for single members in the overview under “Mandatory hours …”. Without the Members module only the default applies.

#### Billing

![The “Billing” card.](bild: seite=aw-einstellungen; ziel=[data-set="abrechnung"])

- **Hourly rate for missing hours** in euros (0 = nothing is billed).
- **Billing year:** calendar year or the same as the members’ fee year.
- **Bill from year:** earlier years are never billed, because nobody recorded hours then.

Missing hours are added in the fee run as a “Work hours” item, with the text “x h not completed × hourly rate”.

#### Tablet & app

![The “Tablet & app” card.](bild: seite=aw-einstellungen; ziel=[data-set="tablet"])

- **Round on tablet to (minutes):** clocked time is rounded like this.
- **Hours clocked on the tablet (with PIN) count as confirmed immediately.** Without the tick you confirm them under “Hours”.
- **Members may report hours in the app.** Without the tick the “Report hours” button is missing in the app.

#### Exempt members

![The “Exempt members” card.](bild: seite=aw-einstellungen; ziel=[data-set="befreit"])

Anyone who is exempt does hours like everyone else (they are recorded) but has no target. At the top you choose the member, enter a **reason** and **Exempt until** (empty = permanently) and click “Exempt”. The list below shows everyone who is exempt; “Lift” takes the exemption back. Changes apply at once, no “Save” is needed here. The same works in the overview under “Mandatory hours …”.

#### Notifications & contact

![The “Notifications & contact” card.](bild: seite=aw-einstellungen; ziel=[data-set="benachrichtigung"])

- **Email reminder about missing hours on (DD.MM.):** on this day once a year an email goes to everyone who has not yet reached their target (to the main payer for families). Empty = off. Needs a mailbox and the Members module.
- **Remind helpers by email the day before:** before every duty and work assignment, those signed up get a reminder, in addition to the notification on their phone.
- **Send cancellations by email to:** anyone who removes themselves in the app triggers an email to these addresses (several separated by commas).
- **Contact for short-notice cancellations:** name and number; shown in the app when removing oneself is no longer possible.
- **Note for members (app and tablet):** a short text, e.g. “Every member from 12 years old does 4 hours a year.”

Members can remove themselves in the app up to 24 hours before the start. After that the contact applies.

#### Transfer settings

![The “Transfer settings” card.](bild: seite=aw-einstellungen; ziel=#sFunc)

Exports this module’s settings as a file and imports them into another Clubwerk installation (without rosters, assignments and hours). On import, entries with the same name (ignoring upper/lower case) are updated, new ones are created and nothing is deleted. The message says for each kind how many were new and how many were updated.

## Tablet and app {#tablet-app}

### Member app

![The “Duties” section in the app: work hours, own duties and free shifts.](bild: app=arbeitseinsatz)

The section is called “Duties” in the bar, and its heading is “Duties & dates”. The **Duties** tab shows:

- **Work hours:** how many hours are still open, with a bar and deadline, and what is still being checked. Once the target is reached it only says “completed – thank you!” and the duties move up. Without a target it says “Helping is welcome anyway!”. For families there is a “Family” tag.
- **My duties:** your own upcoming duties.
- **Duty rosters and dates:** for each roster you pick the day, then “I’ll help”. Anyone signed up sees “you’re in” and the “Remove” button. That works up to 24 hours before the start; after that a notice with the contact from the settings appears. Full shifts show “full”, past ones “over”.
- **My hours:** your own entries with status (being checked, confirmed, rejected with a reason). The **Report hours** button only appears if the setting is on.

#### Reporting hours

With **Report hours** the member reports date, duration and activity; the admin area confirms them under “Hours”.

![Reporting hours in the app.](bild: app=arbeitseinsatz; klick=#dsRep)

#### Answering club dates

If there are club dates, a **Dates** switch appears (with the number still unanswered). There people reply with **I’m coming** (the app asks “How many people are coming? (including you)”, plus a note) or **I’m not coming**. Changing is possible until the reply deadline. Members see the number of acceptances and free places, no names.

![The dates in the app with “I’m coming” and “I’m not coming”.](bild: app=arbeitseinsatz; klick=[data-tab="termine"])

![Accepting with guests.](bild: app=arbeitseinsatz; klick=[data-tab="termine"]; klick2=[data-ans="ja"])

#### Start page and notifications

On the “For me” start page your own duties and accepted dates appear under “Coming up”. Open dates appear under “To do” only as one note “Dates: n replies open” (no buttons, no time limit while the reply deadline is running); it names the date with the nearest deadline and leads to the “Dates” tab. So do missing work hours, linking to the free duties. There are also notifications: **Duty reminder** (the day before) and **Reminder for a date** (invitation, request for a reply shortly before the deadline, reminder the day before for those who accepted). Members switch them on in the app under Notifications, per phone.

### Tablet

![The “Duties” tab on the tablet: who is clocked in right now and what is on today.](bild: tablet=Duties; hoehe=520)

On the tablet members clock in and out for duties:

1. **Start assignment:** type the name (matches appear from two letters), enter the PIN.
2. Choose the assignment: today’s assignments and the permanent ones such as bar duty. If there is exactly one today it is already selected and a description is optional; otherwise briefly describe what you are doing. “Clock in”.
3. **Clock out:** tap the tile with your name. A confirmation shows name, assignment and time so far, then comes the PIN. Times under 5 minutes are discarded. After clocking out the counted time is shown, confirmed or “the board will confirm it”, depending on the setting.

![The “Who are you?” choice when clocking in.](bild: tablet=Duties; klick=#startBtn; hoehe=520)

Club dates (type “Date”) do not appear on the tablet.

## Permissions {#rechte}

| Permission | What it allows |
|---|---|
| Duties & dates | See and edit all five tabs: manage rosters, assignments and club dates, confirm and add hours, change targets, exemptions and settings, enter replies for members |
| Events (Sales) | Also needed to “transfer a duty roster to Sales” |

Members need no permission: whether they see the “Duties” section in the app is set under Member app › Sections.

## Working with other modules {#zusammenspiel}

- **Members:** supplies age, fee type, status (active, passive, honorary), joining and leaving dates, families and email addresses. The module works out the target from this and adds missing hours as a “Work hours” item to the **fee run**. A member’s data report includes their sign-ups, hours, exemption and targets; open sign-ups and unconfirmed hours show in the member view.
- **Sales:** a duty roster can be transferred as an event (card “Transfer to Sales”).
- **Member app and notifications:** the “Duties” section, the “For me” start page and the occasions “Duty reminder” and “Reminder for a date”.
- **Mailbox:** reminders and cancellations by email need a mailbox to be set up.
- **Setup, search and overview:** the setup assistant has a step “Target and billing”, the search (Ctrl/⌘ K) finds duty rosters, tabs, cards and actions, and the admin start page shows hours completed and to be confirmed.
- **Data protection:** the module appears in the record of processing activities.
