# Faults
<!-- kurz: Members report defects around the grounds with a photo – you work through them. -->

## What is this module for? {#wofuer}

Members report broken or dangerous things around the grounds: a torn net, a dripping tap, a loose line. They do it in the member app or on the tablet, with a location, a short description and up to three photos. In the admin area you see all reports at a glance, assign them to someone, reply to the reporter and set the status. Anything already reported is not reported twice.

The module works on its own. Without the Members module only accounts that are signed in to the app can report; without Courts the only locations are the ones you create yourselves.

## Setting up {#einrichten}

1. **Settings › Modules:** switch “Faults” on. With “Demo” you can try the module with made-up data first.
2. **Give the permission:** under Settings › Users & permissions, give the “Faults” permission to whoever should handle reports (e.g. the groundskeeper).
3. **Create locations:** “Settings” tab › “Locations” (see below). That is all; members see the “Faults” area in the app straight away.

## Admin area {#verwaltung}

The “Faults” page has three tabs at the top: **Open**, **Done** and **Settings**.

### “Faults” page {#maengel}

![The “Faults” page on the “Open” tab: the report on the left, date, status and assignee on the right.](bild: seite=maengel; tab=offen)

The first tab shows in brackets how many reports are still open. Urgent reports carry a red mark.

### “Open” tab {#maengel-offen}

For each report the list shows a thumbnail, the location, the first lines of the description and the columns **Reported** (date, time and reporter), **Also reported** (how often other members said “Yes, that's it”), **Status** and **Assigned to**.

- **Sort:** “Newest first”, “Urgent first” or “Most reported”. This shows what matters most to members.
- **Open a report:** tap the row or the pencil at the end of the row.

![An open report: photos, description, status, assignee, reply and internal note.](bild: seite=maengel; tab=offen; klick=tr[data-sel]; ziel=dialog)

In the open report you see the photos (tap for a large view) and the description. Below them you set:

- **Status:** New, In progress, Done or Rejected (e.g. for a duplicate report).
- **Assigned to:** who takes care of it. All users with the “Faults” permission are listed.
- **Reply to the reporter:** appears in the member app and arrives as a notification on the phone. Everyone who said “Yes, that's it” receives it too.
- **Internal note:** only visible to users with the “Faults” permission.

“Save” applies everything. “Delete report” removes the report and its photos for good; for finished reports this is not necessary, they disappear by themselves after the set period.

> Simply setting a report to “Done” keeps the list tidy and informs the reporter. Only delete nonsense or test reports.

### “Done” tab {#maengel-erledigt}

![The “Done” tab with finished and rejected reports.](bild: seite=maengel; tab=erledigt)

Finished and rejected reports are kept here with their completion date. You can open and change them like open reports, e.g. when a problem comes back. The top says after how many months they are deleted together with their photos.

### “Settings” tab {#maengel-einstellungen}

The tab consists of four cards.

#### Locations

Members choose from this list when reporting. “+ Add location” creates a new one, the arrows sort them, “Remove” deletes one from the list. If the Courts module is active, its courts and equipment appear automatically in front of your own locations. “Other location” with free text is always available. Then “Save”.

![“Locations” card: create, sort and remove your own locations.](bild: seite=maengel; tab=einstellungen; ziel=[data-card="orte"])

#### Notifications

For new reports, all users with the “Faults” permission receive a push notification, provided their account is linked to a member and that member has switched notifications on in the app. You can also switch on e-mail (to the address of the linked member) and enter a list of further recipients, separated by commas, e.g. the caretaker's address.

![“Notifications” card: e-mail and further recipients.](bild: seite=maengel; tab=einstellungen; ziel=[data-card="benachrichtigungen"])

#### Retention

“Delete finished reports after” … months (default 12). The whole report is deleted with all photos, rejected ones too. Open reports always stay.

![“Retention” card: period in months.](bild: seite=maengel; tab=einstellungen; ziel=[data-card="aufbewahrung"])

#### Transfer settings

Export locations and settings as a file and import them into another Clubwerk installation (without reports and photos).

## Tablet and app {#tablet-app}

![The report form in the member app.](bild: app=maengel; klick=#mgNew)

![The “Faults” tab on the tablet.](bild: tablet=Faults; hoehe=430)

**In the app** (“Faults” area) the member chooses the location, describes the problem, attaches up to three photos (camera or gallery; location data is removed) and can tick “Urgent”, e.g. when someone could get hurt. If there are already open reports for the same location, the app asks “Is it one of these?”. With “Yes, that's it” nothing is reported twice; “also reported” is counted up instead. Under “My reports” the member sees the status and the club's reply.

**On the tablet** (“Faults” tab) you choose your name, enter the member PIN and report in the same way. It does not work without a PIN.

## Permissions {#rechte}

| Permission | What it allows |
|---|---|
| Faults | View and handle reports, push for new reports, change locations and settings |

Anyone who uses the member app may report, including accounts without a member (e.g. coaches).

## Working with other modules {#zusammenspiel}

- **Courts:** its courts and equipment appear automatically as locations.
- **Members:** the reporter appears as “Last name, first name”; a member's data export lists their reports, and when duplicate members are merged the reports move along. Leaving the club does not delete reports; the retention period still applies.
- **Privacy:** the retention period also appears under Settings › Privacy.
