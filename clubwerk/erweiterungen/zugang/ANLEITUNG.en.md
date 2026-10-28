# Access
<!-- kurz: Open doors, gates and locks with a phone – with time profiles, blocked days and a history. -->

## What is this module for? {#wofuer}

Members open the doors, gates and locks of the clubhouse with their phone: in the member app, with their personal PIN. You decide who may open at all, on which days of the week and at what times, and on which days nobody should get in (for example during a deep clean). Every opening appears in the history, and so do rejected attempts. If you like, doors can also be opened on the club tablet, and in the admin area you can operate doors remotely.

Clubwerk switches the devices through Home Assistant. It does not matter which manufacturer is behind them (for example Nuki, Yale, tedee or Shelly). The module works on its own; without the member management, names are just first and last name.

## Setting up {#einrichten}

1. **Set up the devices in Home Assistant:** The locks, door openers or gate drives must already be running in Home Assistant (Settings › Devices & services). Which integration fits your manufacturer is shown on the “Settings” tab.
2. **Settings › Modules:** Switch on “Access”. With “Demo” you can try the module first with made-up data.
3. **Assign permissions:** Under Settings › Users & permissions, give the “Access” permission to whoever should set everything up. Anyone who may only open doors remotely (for example the caretaker) gets “Operate access”.
4. **Add the doors:** “Doors” tab › “+ Door”. Then try opening each one under “Operate”.
5. **Check the time profiles:** “Member” (daily 07:00–23:00) and “Round the clock” already exist. You create your own times on the “Time profiles” tab.
6. **Authorise members:** “Authorisations” tab › “+ Enable member”. The member scans the QR code with their phone and chooses a PIN. Done – the doors appear in the app.

## Admin area {#verwaltung}

The “Access” menu has seven pages, shown as tabs at the top: **Operate**, **Authorisations**, **Doors**, **Time profiles**, **Blocked days**, **History** and **Settings**. Anyone with only the “Operate access” permission sees just “Operate”.

### Page “Operate” {#zugang}

![The “Operate” page: the doors to open at the top, the emergency card below.](bild: seite=zugang)

Here you open and close doors remotely, for example when someone is standing at the door having forgotten their phone. The same page also shows whether everything is fine with the locks.

#### Doors

Each door is a tile with its name, state (for example “locked”) and buttons. Locks have “Unlock” and “Lock”, door openers only “Open”, gates “Open” and “Close”. If a lock cannot be reached, its tile is greyed out; if it is jammed, it is marked as a warning.

Before every command Clubwerk asks for confirmation. The door is then switched immediately and noted in the history.

![The confirmation before opening remotely.](bild: seite=zugang; klick=#zRemote .vh-acts button; ziel=#askBox)

> Clubwerk never locks up by itself. Whoever unlocked a door also locks it again. The overview shows a notice while a lock is open.

If there are no doors yet, a button leads straight to the “Doors” tab. If the connection to Home Assistant is missing, a red notice with a link to the check in the settings appears at the top.

#### Emergency

![“Emergency” card: “Block everyone now” stops all members from opening.](bild: seite=zugang; ziel=.card:has(#zBlockAll))

“Block everyone now” stops opening in the app and on the tablet for all members, for example after a lost phone or in case of misuse. Clubwerk asks for confirmation first. The remote control above keeps working. While the block is active, a red notice appears on the page and the button reads “Lift block for everyone”. Every block is recorded in the history (action “Block”) and in the admin log.

### Tab “Authorisations” {#zugang-freischaltungen}

![The “Authorisations” tab: who may open doors, with phone, time profile and last use.](bild: seite=zugang-freischaltungen)

Here you decide who may open doors in the member app. This is the only place for it; in the member app and on the member records the time profile is shown for information only, with a link to this tab.

#### “Authorised” list

The heading shows in brackets how many people are authorised. Columns:

- **Member:** “Last name, first name”. Blocked members carry a red “locked” marker and are dimmed.
- **Phone:** “Phone authorised” (phone is paired), “QR code open” (invitation sent, not yet scanned), “QR code expired” or “without phone”.
- **Time profile:** name of the profile, followed if needed by “until <date>” and “also away”.
- **last used:** when the member last opened a door (hidden on phones).

With the filters above the list (**All**, **with phone**, **without phone**, **locked**, each with a count) you can, for example, find everyone who has not yet scanned a QR code. “locked” only appears if there are blocked members.

Each row has **QR code** (only while no phone is paired; shows a new invitation code) and **Edit**.

#### + Enable member

![“Authorise member” window: choose a member, who gets the default profile.](bild: seite=zugang-freischaltungen; klick=#zMemNew; ziel=dialog)

The button is at the top right of the tab bar. Choose a member (coaches without membership are marked “(Trainer)”) and click “Authorise”. The member gets the default profile. The QR code for the member app then appears. Anyone who already has a paired phone does not need a new code.

> Do not photograph or forward the QR code. Whoever scans it first gets the access.

#### Edit

![Window for editing an authorisation: time profile, validity, away, block.](bild: seite=zugang-freischaltungen; klick=[data-me]; ziel=dialog)

Everything about one member is in one window:

- **Time profile:** which profile applies (see the “Time profiles” tab).
- **Valid until:** after that date the authorisation ends. Empty means unlimited. Handy for guests or temporary helpers.
- **Allow opening away from the club:** lets the member open doors outside the club network. This only works if “Open only from the club network” is switched off on the “Settings” tab.
- **Blocked:** the authorisation stays, but opening is not possible. Useful if someone should temporarily stay out.
- **Remove access …:** takes the doors out of the app immediately. Clubwerk asks for confirmation in the same window; the member’s other sections (for example irrigation) stay.

![Confirmation when removing access.](bild: seite=zugang-freischaltungen; klick=[data-me]; klick2=#zmDel; ziel=dialog)

“Save” applies all changes.

### Tab “Doors” {#zugang-tueren}

![The “Doors” tab: all doors with type, device and door contact.](bild: seite=zugang-tueren)

The list shows each door with its **name**, **type**, the **device in Home Assistant** and the **door contact**. The order also applies in the app; use the arrows ↑ and ↓ to move a door up or down, which is saved straight away. Up to 50 doors are possible.

If the connection to Home Assistant is missing, a red notice appears at the top.

#### + Door / Edit

![“Add door” window: name, type, device, door contact.](bild: seite=zugang-tueren; klick=#zDAdd; ziel=dialog)

“+ Door” is at the top right. In the window you set:

- **Name:** what the door is called in the app (up to 30 characters), for example “Front door”.
- **Type:** **Lock** (unlock and lock), **Door opener (pulse)** (a relay that switches briefly) or **Gate / drive** (open and close).
- **Device in Home Assistant:** the list only shows suitable devices. The manufacturer from the “Settings” tab filters the list. A device that another module already uses (for example irrigation) cannot be used a second time.
- **Door contact (optional):** a sensor that reports whether the door is open. This also makes the “door open too long” notice work.
- **Pulse (seconds):** door openers only. How long the relay stays on (1 to 30 seconds, default 3).

![A door of type “Door opener (pulse)” also has the “Pulse (seconds)” field.](bild: seite=zugang-tueren; klick=[data-de="2"]; ziel=dialog)

When editing, **Remove door …** is set apart at the bottom. Clubwerk asks for confirmation in the same window; the door disappears from the app and from the time profiles.

> When the doors are changed, the board gets a safety message showing “before” and “now”. That way you notice if someone enters a different device without permission.

### Tab “Time profiles” {#zugang-profile}

![The “Time profiles” tab: a profile with doors, weekdays and times.](bild: seite=zugang-profile; ziel=[data-prof="0"])

A time profile says **which doors** a member may open and **when**. Each profile is its own card with its own “Save”. Every member has exactly one profile.

#### A profile card

- **Name:** up to 30 characters, for example “Juniors” or “Coaches”.
- **Default for new authorisations:** every newly authorised member gets this profile. There is always exactly one default profile.
- **Doors:** “All (including future ones)” or individual doors. With “All” the profile also covers doors you add later. Doors that are not in the profile are not shown to the members in the app at all.
- **Times for each weekday:** one line per day, for example `07:00–23:00`. Separate several time windows with a comma (`07:00–12:00, 14:00–22:00`). Empty or “geschlossen” (closed) means nothing works on that day. “ganztägig” (all day) means round the clock. Windows across midnight are allowed (for example `18:00–02:00`).
- **Copy Monday to all days** and **Copy Monday to Mon–Fri:** saves typing when the same times apply every day.
- **Delete profile …:** Clubwerk asks first. Members with this profile get the default profile. The last profile cannot be deleted.

![The “Round the clock” profile: all doors, all day, every day.](bild: seite=zugang-profile; ziel=[data-prof="1"])

If Clubwerk does not understand a time entry, it tells you exactly which line is meant (“please use e.g. 07:00–23:00”).

#### + Time profile

“+ Time profile” is at the top right. The new profile is first called “Neues Profil” (new profile), covers all doors and runs daily from 07:00 to 23:00. Adjust it and click “Save”.

> If you change a profile, it applies immediately to every member who has it.

### Tab “Blocked days” {#zugang-sperrtage}

![The “Blocked days” tab: periods when nobody can open.](bild: seite=zugang-sperrtage)

On blocked days the app opens nothing for anyone, for example during court renovation, a deep clean or club holidays. The list shows **Period** and **Reason**. The remote control in the admin area keeps working. In the member app, members see “Blocked today” with the reason on those days.

#### + Blocked period / Edit

![“Blocked period” window: from, to and reason.](bild: seite=zugang-sperrtage; klick=[data-be]; ziel=dialog)

“+ Blocked period” is at the top right. Enter **From** and **To** (the same for a single day) and optionally a **Reason**. “To” must not be before “From”. It is saved immediately. When editing, **Lift blocked period …** (with confirmation) removes the block again. Up to 50 periods are possible.

### Tab “History” {#zugang-verlauf}

![The “History” tab: month selector and entries (here the first “Rejected” entry with its reason).](bild: seite=zugang-verlauf; ziel=#zLog tr:has(.pill.a))

The history shows who opened, closed or blocked which door and when, including rejected attempts. At the top you choose the **Month**. Columns:

- **Time**, **Door** and **Who** (name of the member or of the admin user).
- **Action:** Unlocked, Locked, Opened, **Rejected** (with the reason under “Note”, for example “Not now – possible again from tomorrow 14:00.”), **Error** (the door did not respond), **Authorisation**, **Alarm** (door open too long) and **Block** (emergency block or switch-off on the tablet).
- **Note:** for example “am Tablet” (on the tablet) or “Fernbedienung aus der Verwaltung” (remote control from the admin area).

“Excel” (top right) downloads the chosen month as a spreadsheet. The nightly backup also includes the current month as an Excel file.

> The history contains names and times and is deleted automatically after the set period (default 30 days, see “Working with other modules”).

### Tab “Settings” {#zugang-einstellungen}

The tab consists of four cards.

#### Connection

![“Connection” card: choose the manufacturer.](bild: seite=zugang-einstellungen; ziel=.card:has(#zVendor))

Here you choose the **manufacturer** (Nuki, Matter, Yale, tedee, SwitchBot, HomeKit, Shelly, ESPHome or “Mixed / other manufacturer”). This only filters the device list on the “Doors” tab to make it shorter. Below it you can see which integration you need to add in Home Assistant. Locks appear there as `lock.*`, door openers as `switch.*` or `button.*`, gates as `cover.*`. “Mixed” shows all devices.

#### Security

![“Security” card: open only from the club network.](bild: seite=zugang-einstellungen; ziel=.card:has(#zWlan))

“Open only from the club network” is on by default: requests from the internet are rejected, and only people on the club Wi-Fi can open. Which addresses count as the club network is set centrally under Settings › Reachability (with the “Settings” permission; the link is on the card). If you switch the option off and allow a member to “Allow opening away from the club”, opening also works over the internet.

> Leave the option switched on unless you need it off. Anyone who can unlock from anywhere can also do so with a stolen phone and a known PIN.

#### Notifications

![“Notifications” card: recipient and time for “door open too long”.](bild: seite=zugang-einstellungen; ziel=.card:has(#zNotify))

Clubwerk can notify your phone when a door could not be opened or locked or is open too long:

- **Report faults or an open door to:** the name of the phone in Home Assistant (the “notify” service, for example `mobile_app_phone_board`). Empty = no notification.
- **Report a door open for longer than … minutes:** 0 = off. This only works for doors with a door contact and reports each open door once. An “Alarm” entry appears in the history.

#### Transfer settings

At the bottom of the page: export doors, time profiles, blocked days and settings as a file and import them into another Clubwerk installation. Authorisations, history, PINs and keys are not included.

## Tablet and app {#tablet-app}

![The “Doors” section in the member app.](bild: app=zugang)

![The “Doors” page on the tablet.](bild: tablet=Doors; hoehe=560)

**In the app** (section “Doors”) the member only sees the doors their time profile allows. At the top it shows whether the connection to the locks is up. Each door shows its state and the matching buttons. When tapped, the app asks for the personal PIN and then opens (or unlocks and locks). If opening is not allowed right now, the tile is greyed out and gives the reason: for example “Not now – possible again from tomorrow 14:00.”, “Blocked today: deep clean of clubhouse” or “Access has been temporarily blocked for everyone by the board.” Below the tiles is the member’s own time profile with its times and, if set, “valid until”. The view refreshes itself every few seconds.

For a member to see the section in the app at all, they must be authorised (“Authorisations” tab). Under Member app › Sections you also set whether “Doors” can be reached away from the club. The default is no, club Wi-Fi only.

**On the tablet** (optional) there is a “Doors” tab in the header bar if you switched it on under Settings › Tablet with “show on tablet” and at least one door exists. To open a door, tap it, type the first letters of your name, choose yourself and enter the app PIN. The tablet never remembers the PIN. Only authorised members with a paired phone who are not blocked appear. Time profiles, blocked days and the emergency block apply just as in the app.

![On the tablet: choose a name and enter the PIN.](bild: tablet=Doors; klick=[data-d]; hoehe=700)

> The tablet protects itself. After 3 wrong PINs for the same name (or 5 on the same device) within 15 minutes there is a 30-minute pause. After 10 wrong PINs within 24 hours, opening on the tablet switches off completely and the board receives a warning. You can switch it back on under Settings › Tablet. The app keeps working.

## Permissions {#rechte}

| Permission | What it allows |
|---|---|
| Access | Everything in the “Access” menu: authorisations, doors, time profiles, blocked days, history and settings; also remote opening and the emergency block |
| Operate access | Only the “Operate” page: open and close doors remotely, set and lift the emergency block. Nothing can be set up |

Only users with the “Settings” permission can change Settings › Reachability (club network).

## Working with other modules {#zusammenspiel}

- **Member app:** Doors are a section of the app; authorisation, QR code and PIN go through it. Coaches without membership can also be authorised if you have allowed the section for them.
- **Members:** Names appear as “Last name, first name”. A member’s data access request includes their door openings.
- **Setup:** The setup assistant guides you through “Connection of the doors” and “Add doors”.
- **Overview:** The start page shows doors, authorised members, “Opened today” and open doors, and warns about a missing connection, jammed or unlocked locks and the emergency block.
- **Tablet:** The “show on tablet” switch is set centrally under Settings › Tablet.
- **Privacy:** Under Settings › Privacy you set how long door openings are kept (7 to 365 days, default 30). After that Clubwerk deletes them every day by itself. The record of processing activities includes the purpose “access to the clubhouse and grounds”.
- **Irrigation and other modules that use Home Assistant:** A device can only be used in one module; Clubwerk rejects double assignments.
- **Backup:** The nightly backup includes the door log of the current month as an Excel file.
