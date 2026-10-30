# Match play
<!-- kurz: Teams, match days, replies and line-ups – players reply in the app, the team captain selects the line-up. -->

## What is this module for? {#wofuer}

Your club has teams that play match days against other clubs. This module keeps everything in one place: the teams with captain and registration list, the match days (imported from the league or entered by hand) and the players’ replies. Each player taps “can” or “can’t” in the member app. A traffic light shows for every match day whether enough players are available. The team captain selects the line-up in the app and sends it out. The sports officer keeps all teams in view in the admin area.

The module works on its own. Without the members module there are only first and last names, push messages and no emails. Without courts, home matches are not entered as court bookings.

## Setting up {#einrichten}

1. **Settings › Modules:** switch on “Match play”. With “Demo” you can try the module first with made-up data.
2. **Give the permission:** under Settings › Users & permissions, whoever looks after teams and fixtures gets the permission “Match play” (e.g. the sports officer). Team captains do **not** need an admin account, they work in the app.
3. **Create teams:** tab “Teams” › “+ Team” (see below). Or import the fixture list – teams are then created automatically.
4. **Add players:** “Manage players” for each team. Anyone on an active team, or leading one, sees the “Match days” section in the member app.
5. **Fetch the match days:** tab “Match days” › “Import schedule …”. Even before the fixture list is out you can import the league’s framework schedule (“Framework schedule …”).

## Admin area {#verwaltung}

The “Match play” page has four tabs at the top: **Overview**, **Match days**, **Teams** and **Settings**.

### Page “Match play” {#spielbetrieb}

![The “Match play” page with its four tabs.](bild: seite=spielbetrieb; tab=uebersicht; ziel=.tabs)

Where to find what: replies and chasing up in the **Overview**, dates and line-ups in **Match days**, teams and players in **Teams**, switches for the app in **Settings**.

### Tab “Overview” {#spielbetrieb-uebersicht}

The page for the sports officer: who has replied already, and where is it getting tight?

#### Key figures

![The four key figures at the top.](bild: seite=spielbetrieb; tab=uebersicht; ziel=.kpis)

- **Response rate:** the percentage of replies already received for the upcoming dates.
- **Match days in the next 14 days:** how many matches are coming up soon.
- **Too few confirmations:** matches in the next 14 days without enough available players. The card is highlighted then.
- **Open withdrawal requests:** selected players who want to withdraw and are waiting for the captain’s decision.

#### Needs attention

![The “Needs attention” card with the items someone should look after.](bild: seite=spielbetrieb; tab=uebersicht; ziel=.sp-al)

Only things that need action are listed: a red dot for too few confirmations, a yellow one for “line-up not sent yet” (when the match day is near) and for open withdrawal requests. “Open” jumps to the match day. If everything is fine, it says “All good”.

#### One card per team

![A team’s reply matrix: players in rows, the next dates in columns.](bild: seite=spielbetrieb; tab=uebersicht; ziel=.sp-dt .card)

At the top are the name, league, captain (“MF”), deputy (“Stv.”), number of players and the minimum. On the right the card shows the percentage “answered”, and “Remind open” sends a push message to everyone who has not replied yet (one message per person with the number of open dates).

Below is the **matrix**: one row per player (with registration list number, guests marked “Guest”), one column for each of the next dates with the date and “Home”, “away”, “prov.” (provisional date) or “Z/A”. The dot before the date is the traffic light. Click the date to open the match day. The cells show ✓ (can), ✕ (can’t) or · (open). A ring shows: **green** selected, **yellow** reserve, **red** withdrawal request. “open” on the far right counts open replies, and the last row shows “Confirmed / needed”. A key below the cards explains the symbols.

> Teams without players or without upcoming dates are collected on a separate card at the end, so the overview is not full of empty tables.

### Tab “Match days” {#spielbetrieb-spieltage}

![The “Match days” tab as a list: date, fixture and confirmations.](bild: seite=spielbetrieb; tab=spieltage)

At the top you choose the **team** (“All teams” or one team), the view **List** or **Calendar** and, in the list, **Upcoming** or **Past**. The buttons at the top right are “Print”, “Framework schedule …”, “Import schedule …” and “+ Match day”.

Each row of the list shows the traffic light on the left (green enough confirmations, red too few, grey cancelled or past), the date with weekday and start time, the fixture (“Men against TC Neighbourtown”), home or away match, league and captain, and “Line-up sent” if applicable. On the right are counters: “3 of 4 can”, “2 open”, “4 selected”, “1 withdrawal request”, and for past matches the result. Click a row to open the match day.

#### Calendar

![The calendar view: one month per column, one day per row.](bild: seite=spielbetrieb; tab=spieltage; klick=[data-cal="1"]; ziel=.sp-calw)

The calendar shows the year like the league’s framework schedule: one column per month, one row per day, today is outlined. Each match is a small tag with the team and **H** (home) or **A** (away): green with enough confirmations, red with too few, dashed as a provisional date (“RT”, “Z/A”), struck through if cancelled. Tap it to open the match day. At the top you choose the year. “Print” prints the calendar on one landscape A4 page.

#### Opening a match day

![A match day’s window: replies, line-up, meeting point and tasks.](bild: seite=spielbetrieb; tab=spieltage; klick=.sp-g; ziel=dialog)

The window shows team, opponent, date and venue at the top, and the counters (“3 of at least 4 can”, “1 can’t”, “2 open”, “4 playing · 1 reserve”). The table lists every player of the team:

- **No.:** place on the registration list.
- **Player:** name, plus labels: “Guest”, “Stand-in” (from another team) and “plays in …” (already selected for another team that day). A note from the player appears below.
- **Availability:** open, can (with “from …/until …”) or can’t. You can also enter it here **on the player’s behalf**, e.g. if they confirm by phone.
- **Line-up:** “–”, “playing” or “Reserve”. Anyone already playing elsewhere that day is locked – a player plays at most once a day.
- **Withdrawal:** if someone selected wants to withdraw, the row is yellow. “Confirm withdrawal” takes them out (you then have to select a replacement), “decline” keeps them in. They get a reply on their phone.

Below that:

- **Stand-in from another team:** choose a player from another team and “Select as reserve”.
- **Meeting point & notes:** time, place, result and a “Note to the team” (e.g. “please wear white”). “Save meeting point” applies it.
- **Tasks:** only visible if switched on (see Settings). Pick a player for each task (e.g. driver), “remove” deletes it, “+ Driver” adds a new one.

The buttons at the bottom: **Edit match day …** (opponent, date, start, venue, status, result), **Remind open** (push to everyone without a reply), **Send line-up** (asks first; goes out as a push and – with the members module and email switched on – as an email with a calendar entry to everyone selected and the reserves) and **Close**.

> If a match day is moved or cancelled, the team is notified. A line-up that has already been sent can simply be changed and sent again.

#### New match day and editing a match day

![The “New match day” window.](bild: seite=spielbetrieb; tab=spieltage; klick=#spNew; ziel=dialog)

Team and opponent, date and start, home or away and, for away matches, the venue (ground, street, town). When editing, **Status** (planned or cancelled) and **Result** are added, plus “Delete” – replies and line-up are lost then, so Clubwerk asks first.

#### Import schedule

![The “Import schedule” window: paste a table or choose a file.](bild: seite=spielbetrieb; tab=spieltage; klick=#spImp; ziel=dialog)

This is how the league’s matches get into the system without typing:

1. On the league’s website, select the table of fixtures (from “Date” to the last match), copy it and paste it into the field – e.g. nuLiga “Begegnungen”. Or choose a file: CSV, Excel or calendar (.ics, e.g. fussball.de “Spielplan exportieren”).
2. “Read in” shows the check page: at the top your club name (used for “home match” – changing it re-reads the table), the number of matches and home matches found. For each team found you choose whether it is **created new** or belongs to an **existing** one. In the list of matches you tick what is taken over; each row is marked “new”, “moved” or “already entered”. Only upcoming matches of your own club are imported, away matches too.
3. With courts: “Also enter home matches as court bookings”.
4. “Import X match days”. Afterwards a message says what happened: new, created from provisional dates, moved, teams created.

You can repeat the import at any time: matches already entered are left alone, moved ones are adjusted and replies are kept.

#### Framework schedule

![The “Import framework schedule” window.](bild: seite=spielbetrieb; tab=spieltage; klick=#spRtp; ziel=dialog)

Long before the fixture list, the league publishes the framework schedule as a PDF with the match days per age class. You choose the PDF, then check on the next page the suggested **age class** for each team (guessed from name and league, changeable, “do not take over” is possible) and see the dates found from today on. With the tick “Also poll additional and alternative days (Z/A)” those are added as dashed dates. “Take over for X teams” creates **provisional dates**.

Provisional dates are grey in the list and are called “Framework date”. Players only see them once you click “**Start poll**” in the yellow notice at the top of the tab. They then appear in the app, all players get a push message and reply “can” or “can’t”. When the fixture list arrives later, each provisional date becomes the real match day – the replies are kept. Dates without a match are dropped; anyone who had replied “can” gets a “no match” message.

![The yellow notice with the “Start poll” button.](bild: seite=spielbetrieb; tab=spieltage; ziel=.banner)

A provisional date has a simpler window: only replies, no meeting point and no line-up. It offers “Remind open” and “Delete date”.

### Tab “Teams” {#spielbetrieb-mannschaften}

![The “Teams” tab: one card per team with its registration list.](bild: seite=spielbetrieb; tab=mannschaften)

Each team is a card: name, below it age class, league, season, minimum, captain and deputy, below that the registration list as small tags with number and name. Inactive teams are marked. A yellow tag after a name is a **hint** (not a ban): “turns only 38 in 2027 (H40)” for players too young for an age class, “male – women’s team” in the women’s teams, “date of birth missing”. The season year from the “Season” field counts (“Summer 2027” gives 2027, “Winter 2026/27” gives 2027), otherwise the current year. The hints need the members module (date of birth, gender); youth teams are mixed and get no hint.

#### Creating and editing a team

![The “New team” window.](bild: seite=spielbetrieb; tab=mannschaften; klick=#tmNew; ziel=dialog)

- **Name:** e.g. “Men 40 I”. The same team (same age class and number) cannot be created twice; Clubwerk suggests “Men 30 II”. “Women 40” and “Men 40” are two teams.
- **League** and **Season:** for display and for the hints only.
- **Age class (framework schedule):** e.g. H40, D, HL H30 – needed for the framework schedule.
- **Minimum players per match day:** from this number of confirmations the traffic light turns green.
- **Captain** and **Deputy:** chosen from the members. Both select the line-up in the app – without an admin account.
- **Active:** inactive teams disappear from the app but are kept.

“Delete” asks exactly what goes with it: match days with replies, the registration list and guest players who are only on this team. “Not active” keeps everything.

#### Manage players

![The “Players” window: search on the left, registration list on the right.](bild: seite=spielbetrieb; tab=mannschaften; klick=[data-pl]; ziel=dialog)

On the left you search members and guest players and add them to the team with **+**. On the right is the **registration list** (number 1 at the top), which you reorder with ▲ and ▼; ✕ takes someone out. A person can play on several teams. “Save” applies the list. Anyone left on no team at all is reported.

**Guest players** are not club members (e.g. in a joint team with a neighbouring club). “+ Add guest player” asks for first and last name, optionally club and mobile number. Guests have no account and no app. Instead each guest gets a **personal link**: the link button copies it (e.g. for WhatsApp), the pencil edits details and shows when the link was last opened. “New link …” invalidates the old one, “Remove completely …” deletes the guest from all teams. A guest link expires after 12 months without use or when the guest is on no active team any more.

> For the link, the member app needs an address reachable from outside (Member app › Settings).

### Tab “Settings” {#spielbetrieb-einstellungen}

Four cards, each with its own “Save”. Switched-off areas (tasks, reminders) stay collapsed until you switch them on.

#### What players see in the app

![The “What players see in the app” card.](bild: seite=spielbetrieb; tab=einstellungen; ziel=[data-card="sehen"])

- **Who else is available:** players see the names of the others who have confirmed for a match day.
- **Line-up:** players see who is selected. The captain always sees everything.
- **Captain with mobile number:** the top of “Match days” shows whom to call with questions (with a “Call” button). The number comes from the members.
- **Offer “can from …” / “can until …”:** players can add a time to their confirmation, e.g. if someone arrives later.

#### Tasks

![The “Tasks” card with the list of task types.](bild: seite=spielbetrieb; tab=einstellungen; ziel=[data-card="aufgaben"])

With “Tasks per match day” the captain assigns tasks such as driver or bringing a cake; players can take on open tasks themselves in the app. With “+ Task” you create the task types (preset are driver for away matches, catering for home matches, and bring balls and enter match report for every match) and set for each whether it applies “every match”, “home matches only” or “away matches only”. “Remove” deletes the type from the list.

#### Reminders & messages

![The “Reminders & messages” card.](bild: seite=spielbetrieb; tab=einstellungen; ziel=[data-card="erinnerungen"])

- **Automatic reminders:** players without a reply get a push message before the match day (“Remind players … days before”, default 7). The captain gets a warning if too few can play (“Warn captain … days before”, default 5).
- **Important messages also by email:** line-up and withdrawal requests also by email to the address from the members, with a calendar entry. Push is always sent. Without the members module there is only push.

The board decides which push messages exist under Member app › Notifications. The module brings these occasions: “You are selected”, “Line-up sent”, “Withdrawal request”, “Reply to withdrawal”, “Match day moved/cancelled”, “Please report availability”, “Too few players”, “Provisional dates” and “Task taken/assigned”.

#### Transfer settings

![The “Transfer settings” card: export and import.](bild: seite=spielbetrieb; tab=einstellungen; ziel=#spFunc)

Export teams (without players and match days) and settings as a file and import them in another Clubwerk installation, e.g. for a second club or after a reinstall. No PINs or passwords are included; assign players and import match days again afterwards. On import, entries with the same name (ignoring upper/lower case) are updated, new ones are created and nothing is deleted. The message says for each kind how many were new and how many were updated.

## Tablet and app {#tablet-app}

This module is not on the tablet. Work is done in the member app in the **Match days** section. It appears for everyone who plays on an active team or leads one. On the “For me” start page, “To do” shows only a note “Match days: n replies open”, without ✓/✕ buttons and without a time limit. Tapping it leads to the “Match days” section, where you reply.

#### For players

![The “Match days” section in the app: one row per match day with ✓ and ✕.](bild: app=spielbetrieb)

At the top are the team with league and the captain (otherwise the deputy) with “Call”. Below is one row per match day: date, fixture, time, home or away and on the right **✓** (I can) and **✕** (I can’t). Tapping again withdraws the reply. Tapping the row opens details: meeting point, venue, who can, who is selected (depending on the settings) and the tasks (“I’ll do it” / “Hand back”). “Add time” offers “from” and “until” and a note. If you are selected, it says “You are playing” with the meeting point and the button **Can’t make it – request withdrawal**; the captain has to confirm, until then you stay selected. Reserves can withdraw directly. A request can be revoked with “Cancel withdrawal”.

Anyone on several teams chooses the team at the top. In “All” each day appears only once (“Men + Men 30”): one ✓/✕ applies to all teams that day, and opened up you reply separately. With three or more open dates “All ✓ / All ✕” appears. Anyone already selected that day sees “plays in …” instead of ✓/✕ for the other team. At the bottom it shows how often you have played this season.

#### For team captains

![The team captain’s window: select players, enter the meeting point, send the line-up.](bild: app=spielbetrieb; klick=.sb-rh; klick2=[data-lead])

The captain (and deputy) additionally sees the traffic light and the **Line-up** button in every match day. The window lies inside the app and never opens a new browser window. It lists the players, those who can first, and for each player **playing / Reserve / –**. You can also: confirm or decline withdrawal requests, bring in a stand-in from another team as a reserve, create guest players and share their link (through the phone’s share menu), enter replies for guests, save meeting point, result and note, assign tasks, “Remind open” and **Send line-up**. For provisional dates there are only the replies (“Replies · enter for guests”).

#### For guest players

Guests open their personal link. That is a simple page of its own, “Match days”, without login and without the app: one row per day with ✓ and ✕, “All ✓ / All ✕” when many dates are open. The captain sees the reply straight away.

## Permissions {#rechte}

| Permission | What it allows |
|---|---|
| Match play | The “Match play” page in the admin area: manage teams and players, import fixtures and the framework schedule, change match days, select and send line-ups, change settings (sports officer) |

Members in the app need no permission: anyone on a team may confirm or decline. Only the team captain (and deputy) of a team may select its line-up.

## Working with other modules {#zusammenspiel}

- **Members:** players, captains and deputies come from the members module; names appear as “Last name, first name”. It provides mobile number, email address, date of birth and gender (for the hints). A member’s data export lists their teams, replies, line-ups and tasks; when duplicate members are merged the references move along, and when deleting a member Clubwerk shows “Plays in: …” as the reason it is not possible yet.
- **Courts:** the fixture import can enter home matches as court bookings at the same time.
- **Messages:** every active team is a recipient group (“Team Men 40”) with captain and deputy.
- **Member app:** under “To do”, “For me” shows only the note “Match days: n replies open” (no buttons) and leads to the “Match days” section.
- **Data protection and setup:** the module reports to the record of processing activities, to the setup assistant (step “Teams”) and to search (Ctrl/⌘ K finds match days, teams and this page’s actions).
