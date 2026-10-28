# Tournaments
<!-- kurz: Club championship, LK tournament day and your own tournaments such as the village tournament – with draw, schedule, results and wall monitor. -->

## What is the module for? {#wofuer}

The “Tournaments” module has three parts. Use them separately or together:

- **Club championship:** Played all year in leagues (A, B, C …). Members enter in the member app, you draw the groups, they arrange their matches themselves and enter the results. At the end the club champions go on the honours board.
- **Tournament day:** An LK tournament from nuLiga on the day itself. You import the file, check the players in, assign the courts and enter the results.
- **Tournament planner:** Your own tournaments, such as the village tournament, for tennis or football. Groups and knockout stage, round robin, knockout with seeding or a “Schleifchen” (rotating-partner) tournament. With schedule, tables and a wall monitor.

Everything works without the member administration (names then come from the Clubwerk list or are typed in freely) and without the “Courts” module (then there is no court booking and no blocking).

## Setting up {#einrichten}

1. **Settings › Modules:** Switch on “Tournaments”. With “Demo” you can try everything first with invented data.
2. **Give the permission:** Under Settings › Users & permissions, whoever should run tournaments gets the “Tournaments” permission (e.g. the sports officer).
3. **Get started:** For the club championship, create a season on the “Club championship” page. For an LK tournament, import the nuLiga files on “Tournament day”. For a village tournament, create a new tournament on “Tournament planner”.
4. **Optional:** For links and QR codes for players to work, the address of the app must be entered under member app.

## Admin area {#verwaltung}

The menu has three pages: **Club championship**, **Tournament day** and **Tournament planner**. Each has its own tabs at the top.

### Page “Club championship” {#turniere}

The page has six tabs: Overview, Participants, Matches, Tables, Honours board and Settings. A line under the title says where the season stands (for example “Group stage until 31/10”). If there is no season yet, create one with “+ New season”.

![The six tabs of the “Club championship” page.](bild: seite=turniere; tab=uebersicht; ziel=#tuTabs .tabs)

### Tab “Overview” {#turniere-uebersicht}

Four figures at the top: **Entered**, **Open matches**, **Overdue** and **Scored**. Cards below.

![The four figures on the overview.](bild: seite=turniere; tab=uebersicht; ziel=.kpis)

#### Next step

The card tells you what to do now and has the matching button. A season runs like this:

1. **Entry is open:** Members enter in the app. “View participants” jumps to the “Participants” tab.
2. **Draw:** “Draw singles groups”, and for doubles then “Draw doubles partners” and “Draw doubles groups”.
3. **Group stage:** The card counts how many matches are scored. Clubwerk sets the knockout stage and play-offs by itself as soon as a league is finished. After the deadline you end the group stage with “End group stage …”. Clubwerk shows you the open matches first. Anything still open counts as not played and does not count in the table.
4. **Close the season …:** At the very end. First Clubwerk shows the club champions, who changes league through the play-offs and whether matches are still open.

![The “Next step” card with the button for the current step.](bild: seite=turniere; tab=uebersicht; ziel=[data-card="naechster"])

#### Overdue matches

Only appears when matches are still open after their deadline. On each line the bell sends a **reminder** (push to the app and email, if the member administration knows an address). “Remind all” reminds everyone at once.

#### Season

The season’s details: name, leagues, doubles leagues, entry deadline and the two deadlines. “Edit season” changes them. If there are several seasons, choose the season at the top right.

![The “Season” card with the deadlines.](bild: seite=turniere; tab=uebersicht; ziel=[data-card="saison"])

**“+ New season”** opens the window for creating one:

![The “New season” window.](bild: seite=turniere; tab=uebersicht; klick=#tuNew; ziel=dialog)

- **Name** and **Leagues:** How many leagues there are (A, B, C …).
- **Doubles leagues:** Every two neighbouring singles leagues form one doubles league; the default is “A+B, C+D”. A league on its own (e.g. “E”) plays with partners from its own league. Leave it empty for no doubles.
- **Entry deadline, Group stage deadline, Deadline finals + play-offs:** The matches should be played by then. Players see the deadlines in the app too.
- **Carry over league placement:** If there is a closed season, you take over its placement including the play-offs: the winner from the lower league moves up, the loser from the upper league moves down. Nobody is entered yet; whoever enters in the app keeps their league.

For an existing season the edit window also has “Delete season”. This removes entries, groups, matches and results, and booked courts are cancelled.

### Tab “Participants” {#turniere-teilnehmer}

![The participant list of one league with group, singles/doubles and how the player entered.](bild: seite=turniere; tab=teilnehmer; klick=#tuLf [data-f="B"]; ziel=#tuTabs .card)

At the top are **filters** (All, Entered, one per league) with the number of people. The list shows **Name**, **League**, **Group**, **Playing** (singles and/or doubles) and **Entered** (in the app, from the previous season, imported or by hand).

- **Change league:** Directly in the row, in the selection. Newcomers start in the lowest league; move anyone who belongs elsewhere before the draw.
- **Singles and doubles:** Tick boxes in the row. After the draw they appear as text.
- **Remove:** The bin at the end of the row. Anyone already in a group or a pair can no longer be removed.

The buttons at the top right:

- **+ Add player:** Enters a member by hand (search the name, choose league, singles/doubles). The window stays open so you can enter several in a row.
- **Import …:** Only before the draw. Reads the previous season’s placement from Excel (.xlsx) or CSV so nothing has to be typed again. You need the columns “Name” (or “First name” and “Last name”) and “League”, or one sheet per league called “A”, “B1” …. Clubwerk matches identical names with certainty; for similar names it asks and suggests members.

![The “Add player” window.](bild: seite=turniere; tab=teilnehmer; klick=#tuAdd; ziel=dialog)

#### Singles draw

Each league is spread randomly across its groups, equal in size (± 1). From 6 players there are two groups, otherwise one. Everyone gets a message in the app. Afterwards you have:

- **Swap players …:** Two players of the same league change group.
- **Redraw league …:** Draws a league again. Both only work while no match in the group has been scored.

![The “Singles draw” card.](bild: seite=turniere; tab=teilnehmer; klick=[data-card="auslosung"] h3; ziel=[data-card="auslosung"])

#### Doubles

Only visible if there are doubles leagues. First you draw the **partners**: each person from the upper league gets a partner from the lower one. Anyone left over appears under “Without a partner”. With “Form pair …” you make a pair by hand (there is no team of three). Then you draw the **pairs into groups**. Until then a pair can be dissolved with the bin; “Redraw partners …” and “Redraw doubles groups …” repeat the draw as long as nothing has been played.

![The “Doubles” card with the pairs of each doubles league.](bild: seite=turniere; tab=teilnehmer; klick=[data-card="doppel"] h3; ziel=[data-card="doppel"])

### Tab “Matches” {#turniere-spiele}

Filters at the top: **Open**, **Overdue**, **Scored** and **All**, each with a count. The columns: **Match**, **Round** (e.g. “Group A1”, “Semi-final”, “Play-off A/B”), **Date** (with time and court, or the deadline) and **Result** (the score, or “open” or “overdue”). Tap the row or the pencil to open a match:

![The window for entering or correcting a result.](bild: seite=turniere; tab=spiele; klick=tr[data-sel]; ziel=dialog)

- **Scoring:** “Played” (set by set, e.g. 6:4 3:6 10:7), “Walkover (w/o)” (then you choose the winner), “Retired” (who retired, plus the score) or “Not played (doesn’t count)”.
- **Send reminder:** Reminds both players as long as the match is open.
- **Delete result:** The match is open again afterwards.

Clubwerk rejects impossible results (6:5, 8:5, match tie-break 9:7 …). Players can enter their own result only once; after that only you can correct it. Once the season is closed, nothing can be changed any more.

> The table works like the DTB template: first wins, then set difference, then game difference, and with a tie the head-to-head result. A walkover counts as 6:0 6:0; when a player retires, the winner gets the missing games and sets.

### Tab “Tables” {#turniere-tabellen}

All group tables, the knockout stage and the play-offs, just as members see them. **Print** at the top right gives you a sheet for the notice board.

- **Group tables** per league and group, for doubles per doubles league. The places that qualify are marked.
- **Knockout stage:** In singles only the top league plays one: first and second of both groups play the semi-finals crosswise, the winners the final, and the winner becomes **club champion**. In doubles every doubles league has its own knockout stage.
- **Play-offs:** The last of each group plays the group winners of the league below, as soon as both leagues are finished. The result decides the placement for the next season.

![The two groups of a league with tables. Those who qualify are marked.](bild: seite=turniere; tab=tabellen; ziel=.tabbody > div:nth-of-type(4))

![The top league’s knockout stage as a bracket up to the club champion.](bild: seite=turniere; tab=tabellen; ziel=.tabbody > div:nth-of-type(2))

### Tab “Honours board” {#turniere-ehrentafel}

![The honours board with year, title and club champions.](bild: seite=turniere; tab=ehrentafel)

All club champions are listed with **Name**, **Year** and **Title**. Clubwerk enters them itself when the season is closed (those entries cannot be deleted). You add earlier years from before Clubwerk with **+ Entry**:

![The “Add to honours board” window.](bild: seite=turniere; tab=ehrentafel; klick=#tuHon; ziel=dialog)

Year, title (e.g. “Club champion singles” or “Club champion doubles A+B”) and name(s). Remove your own entries with the bin.

### Tab “Settings” {#turniere-einstellungen}

#### Court booking

“Court time per match” sets how long a court is booked for one match (1 to 3 hours). With the “Courts” module the players book the court in the app. The booking counts as a club event: no fee, no quota and no lead time; opening hours, blocks and occupied courts still apply. Without the “Courts” module they only enter day and time.

![The “Court booking” card.](bild: seite=turniere; tab=einstellungen; ziel=[data-card="platzbuchung"])

#### Transfer settings

Export all settings of the module (including those of Tournament day and Tournament planner) as a file and import them into another Clubwerk installation, without seasons, players and results.

![The “Transfer settings” card.](bild: seite=turniere; tab=einstellungen; ziel=#tuFunc)

### Page “Tournament day” {#turniertag}

For an LK tournament. The flow: import the files from nuLiga, check players in, assign courts, start matches, enter results, and finally end the tournament. Six tabs: Control centre, Schedule, Check-in, Results, Courts and Settings. If there is no tournament day yet, the page shows the button “Import nuLiga files …”. Several tournaments on the same weekend become one tournament day. If there are several tournament days, choose one at the top right.

> In nuLiga you export the XML file for each tournament (tournament export). You can add the entry list as CSV; it brings the exact LK and “cash” as the payment method. Only name, club, LK, gender, year of birth and the nuLiga numbers are taken over, no addresses, emails or phone numbers.

### Tab “Control centre” {#turniertag-zentrale}

The command post on the day. At the top: **In progress**, **Queue**, **Scored** (out of all matches) and **Biggest delay**.

![The control centre: every court with the running and the next match.](bild: seite=turniertag; tab=zentrale; ziel=.tl-courts)

- **Court cards:** For each court the running match (with playing time and a “Result” button) and the next one with its expected time. “ready” means both players are checked in, not absent and not still on another court. Then “Start match” starts the match and records the start time. A match more than 15 minutes behind schedule is marked red.
- **Queue:** Matches without a court. The pencil opens the match so you can assign one.

The buttons at the top right are for the whole tournament day:

- **Fill free courts:** Puts ready matches on free courts that are enabled for automatic assignment (tab “Courts”).
- **Original schedule …:** Restores court and time from nuLiga for every match that has not started yet. Played and running matches stay as they are.
- **Re-import …:** For new files of the same tournament, for example after a late entry. Beforehand Clubwerk shows what changes (new and changed players, changed schedule, matches dropped). Check-in, payments, results and your own rescheduling are kept.
- **+ Tournament day …:** Imports another tournament day.

![The “Re-import from nuLiga” window.](bild: seite=turniertag; tab=zentrale; klick=#tlAgain; ziel=dialog)

Clicking a match opens the match window:

![The match window: change court and time, start, or enter the result.](bild: seite=turniertag; tab=zentrale; klick=.tl-names; ziel=dialog)

- Change **court and time** and apply them with “Save”. Without a court the match goes into the queue.
- **Set pairing …:** For later rounds where nuLiga does not know the pairing yet. A new import overwrites the pairing as long as the match has not been played.
- **Start match** and **Undo start**.
- **Result …** (for played matches “Change result …”). You can also enter walkovers, retirements and corrections here. Players enter their own result on the tablet only once.

![The result window: scoring and sets.](bild: seite=turniertag; tab=zentrale; klick=[data-res]; ziel=dialog)

### Tab “Schedule” {#turniertag-zeitplan}

![The schedule: one column per court, the red line shows the time now.](bild: seite=turniertag; tab=zeitplan)

One column per court with all matches by time; the red line shows “now”. If a match runs long, the following matches on the same court and with the same players (with a break) move back and are marked: yellow from 5 minutes, red from 15 minutes. With several days you choose the day at the top; on a phone you go court by court. Clicking a match opens the match window.

### Tab “Check-in” {#turniertag-checkin}

At the top the **cash report** for the entry fees: total, cash, digital and open. It is kept apart from the sales till. Below are **Search** (name or club), **Sort order** (last name, start time or LK) and filters: All, Not checked in, Checked in, Absent, Not paid. The columns: **Name** (a time request from nuLiga, such as “mornings only please”, is marked), **Club**, **LK**, **First match** and **Status**. The tick at the end of the row checks in straight away.

![Check-in with cash report, search and filters. “Not paid” is selected here.](bild: seite=turniertag; tab=checkin; klick=#tlCf [data-f="unbezahlt"]; ziel=#tlTabs .tabbody)

Clicking the row opens the player card:

![The player card with events, first match, check-in, entry fee and QR code.](bild: seite=turniertag; tab=checkin; klick=tr[data-p]; ziel=dialog)

- **Check in**, **Withdraw check-in**.
- **Absent** and **Back:** Anyone absent holds up their matches; they wait until the player is back.
- **Paid in cash**, **Paid digitally**, **Withdraw payment** for the entry fee.
- **Player page QR code:** Shows the QR code for this tournament (see “Tablet and app”).

At the top right **Print QR codes** prints the codes of all players on one sheet to cut out.

### Tab “Results” {#turniertag-ergebnisse}

![The result list by event and round.](bild: seite=turniertag; tab=ergebnisse; ziel=#tlTabs .card)

All matches by event and round, in the order used by nuLiga. That way you can type the results into nuLiga easily after the tournament. **Print** prints the list; clicking a row opens the match.

### Tab “Courts” {#turniertag-plaetze}

![The courts of the tournament day with their link to the booking system.](bild: seite=turniertag; tab=plaetze; ziel=#tlTabs .card)

The courts come from the court names in nuLiga. For each court:

- **Court in the booking system:** Links it to a court of the “Courts” module. Only then can Clubwerk block it.
- **Distribute automatically:** Only courts marked “yes” are filled by “Fill free courts” in the control centre.
- **+ Court** adds more, for example “Hall court A” for a tournament in someone else’s hall. Such courts block nothing. The bin removes courts you added by hand.

![The “Create court” window.](bild: seite=turniertag; tab=plaetze; klick=#tlAddC; ziel=dialog)

#### Block in the booking system

With **Block courts …** Clubwerk blocks the linked courts for the tournament days between from/to. First it shows which bookings would be cancelled; the members are told. Afterwards you have **Change block …** and **Lift block**. Without the “Courts” module the card is missing.

![The “Block in the booking system” card.](bild: seite=turniertag; tab=plaetze; ziel=[data-card="sperre"])

### Tab “Settings” {#turniertag-einstellungen}

#### Schedule

“Duration per match” (45 to 120 minutes) and “Break between two matches” (none to 60 minutes). Clubwerk works out the expected times from them.

![The “Schedule” card.](bild: seite=turniertag; tab=einstellungen; ziel=[data-card="zeitplan"])

#### Privacy

Clubwerk deletes names, clubs and LK of players from other clubs after the “Deletion period” (7 days to 1 year, default 30 days) after the last tournament day. Your own members (the organiser’s club number) stay. The period also appears under Settings › Privacy.

![The “Privacy” card.](bild: seite=turniertag; tab=einstellungen; ziel=[data-card="datenschutz"])

#### TV in the clubhouse

The address of the TV display: open it in the browser of the TV (on the club Wi-Fi, authorised once with the tablet password). On the day it shows all courts, delays, the queue and the latest results, and updates itself. “Copy address” puts it on the clipboard.

![The “TV in the clubhouse” card.](bild: seite=turniertag; tab=einstellungen; ziel=[data-card="fernseher"])

#### Tournament day

Here you change the **name** of the tournament day and see which files it was imported from. **End tournament …** closes the day: player links stop working, blocks in the booking system are lifted, and results stay for the result list. **Reopen tournament** undoes that. **Delete tournament day** removes players, check-in, entry fees and results and lifts blocks.

![The “Tournament day” card.](bild: seite=turniertag; tab=einstellungen; ziel=[data-card="turniertag"])

### Page “Tournament planner” {#turnierplaner}

For your own tournaments such as the village tournament, for tennis or football. Two tabs: **Tournaments** (the list) and **Honours board**. Each tournament has its own page with five tabs (see below).

### Tab “Tournaments” {#turnierplaner-turniere}

![The list of tournaments with day, type and status.](bild: seite=turnierplaner; tab=turniere)

The list shows **Tournament**, **Day** with start time, **Type** (sport and format) and **Status**: not drawn yet, drawn, today, not ended or ended. Clicking the row opens the tournament. With **+ New tournament** you create one:

![The “New tournament” window with the preview of how many groups and matches there will be and when the tournament ends.](bild: seite=turnierplaner; tab=turniere; klick=#ftNew; ziel=dialog)

- **Name**, **Sport** (tennis or football), **Format**, **Day** and **Start**.
- **Courts** or **Pitches** and **Teams (approx.):** From these Clubwerk works out the preview right in the window: groups, matches and the expected end.
- **Playing time** and **Break** in minutes. The sport sets sensible values: tennis 20 minutes playing time and 5 minutes break, football 12 and 3.
- **Group size** for “Groups + knockout”, **Rounds** for the Schleifchen tournament.

The four formats:

| Format | How it works |
|---|---|
| Groups + knockout | The classic village tournament. The groups come from the number of teams, even with uneven numbers (e.g. 28 teams = four groups of four and four groups of three, never a “free slot”). The best then play the knockout stage crosswise. |
| Round robin | Every team plays every other team once. |
| Knockout with seeding | Seeded teams meet late; if opponents are missing, the best get a bye. |
| Schleifchen tournament | New doubles partners every round, who do not repeat as long as possible. What counts is the matches each person has won. |

### Tab “Honours board” {#turnierplaner-ehrentafel}

![The tournaments’ honours board: winner, runner-up and third place by year.](bild: seite=turnierplaner; tab=ehrentafel)

When a tournament ends, the winner, runner-up and third place are put here automatically, sorted by year. **Print** prints the board.

### Opening a tournament {#turnier}

Clicking a tournament in the list opens its page. At the top it says how things stand (“Tennis · Groups + knockout · Ends around 15:40”), and “All tournaments” above leads back to the list. The tabs: Control centre, Schedule, Tables (“Ranking” for a Schleifchen tournament), Teams (“Participants” for a Schleifchen tournament) and Settings. A typical run: enter the teams, draw in the schedule, start in the control centre on the day, enter results, end the tournament in the settings.

### Tab “Control centre” {#turnier-zentrale}

![The control centre of the village tournament: every pitch with the running and the next match.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=zentrale; ziel=#ftCentral)

As on the tournament day: at the top **In progress**, **Played**, **Biggest delay** and **Ends around**; below it each pitch with the running match (with the remaining time, which counts down by itself) and the next one. A warning shows ties that only a draw of lots can settle. With **Draw lots** Clubwerk draws the order and writes it to the log.

- **Start next matches:** Starts the next match on every free court.
- **Move up:** If a court becomes free early, the next ready match moves forward. If a match runs long, the following ones move back.
- **Open a match** (click the pairing): change court and time, start, undo the start or enter the result.

![The window for entering the result: goals or games and, for a tie in the knockout stage, penalty shoot-out or tie-break.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=zentrale; klick=[data-res]; ziel=dialog)

**Only you** enter the result (here or on the tablet with the tournament director code), not the teams. In football a draw is possible; in the knockout stage a tie is settled by a penalty shoot-out (tennis: tie-break to 7), which does not count for tables. When scoring is by sets, there are also “Walkover” and “Retired”, as in the club championship.

### Tab “Schedule” {#turnier-spielplan}

**Before the draw** the tab shows the “Draw” card: a preview of how many groups and matches there will be, and the **Draw** button. With “With seeding” every group gets one seeded team.

![The schedule before the draw (Schleifchen tournament): preview and “Draw” button.](bild: seite=turnierplaner/turnier/2; tabkey=detail_turnier; tab=spielplan)

**After the draw** every match is listed by time with **Time**, **Pitch**, **Round**, **Match** and **Result**. Filters: All, Open, Played. Nobody plays twice in a row; the groups are spread over the courts.

Buttons at the top right (as long as nothing has been played):

- **Swap …:** Two teams from different groups change group; pitches and times stay.
- **Redraw …:** Groups, pairings and schedule are created again.
- **Recalculate schedule:** After times have changed.
- Once the tournament is running, **Original schedule …** appears instead: every match that has not started goes back to the court and time from the draw.
- **Print** prints the schedule for the notice board.

### Tab “Tables” {#turnier-tabellen}

![A group table with matches, wins, goals, difference and points.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=tabellen; ziel=.ft-groups > .card:first-child)

The group tables and the knockout stage (the bracket in a knockout tournament, the **ranking** in a Schleifchen tournament). The table counts points, then difference, then more goals or games, then the head-to-head result, and finally the lot. You can change this order in the settings. The knockout stage fills itself as soon as a group is finished, and winners move on automatically. Clicking a match in the bracket opens it. Once the tournament has ended, a “Winners” card appears at the top. **Print** prints everything.

![The knockout stage as a bracket.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=tabellen; ziel=.ft-tree)

### Tab “Teams” {#turnier-mannschaften}

![The participants of a Schleifchen tournament before the draw, with “Import …” and “+ Participant” at the top right.](bild: seite=turnierplaner/turnier/2; tabkey=detail_turnier; tab=mannschaften; ziel=#main .tabbody)

The list shows **Team**, **Players**, **Group** (before the draw the **Seed**) and **Status** (“here” or “open”, and with an entry fee also cash, digital or open). If an entry fee is set, the figures **Entry fees total**, **Cash**, **Digital** and **Open** appear at the top (a cash report of its own).

Buttons at the top right, before the draw:

- **+ Team** (“+ Participant” in a Schleifchen tournament): name, seed (seeded teams meet late in a knockout) and optionally the players, one per line, guests too. After saving, the window for the next one opens straight away.
- **Import …:** Excel or CSV. One column with names is enough (header “Name” or “Team”, otherwise the first column); further columns are taken as players. Clubwerk recognises names that already exist.
- **Print QR codes:** Prints a QR code for each team that puts their matches on their phone.

![The “Add player” window (for teams it also has seed and players).](bild: seite=turnierplaner/turnier/2; tabkey=detail_turnier; tab=mannschaften; klick=#ftAdd; ziel=dialog)

Clicking an existing team opens the same window: change name and players, **Is here** and **No longer here**, entry fee paid in **cash** or **digitally**, **QR code** and **Remove** (before the draw only). After the draw teams can only be renamed. You can add teams after “Cancel draw …” (Settings), as long as no result has been entered.

### Tab “Settings” {#turnier-einstellungen}

Everything else is here. When the tournament has ended the fields are locked until you reopen it.

#### Tournament

Name, day, start, **Latest end** (if the expected end is later, Clubwerk warns you), **Entry fee** per team or person (empty = no entry fee) and the **Format**. The sport cannot be changed.

![The “Tournament” card.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=einstellungen; ziel=[data-card="turnier"])

#### Playing time and scoring

You can change everything individually: playing time, break, break after the group stage and between knockout rounds, points for a win, draw and loss, name (Court, Pitch or Field), scoring (by time with goals or games, or by sets), tie in the knockout (tie-break to 7, penalty shoot-out or none), group size, how many per group qualify, third-place match and the **tie-break order** (sort with the arrows; the lot always comes last). If the time changes before play starts, Clubwerk recalculates the schedule.

![The “Playing time and scoring” card.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=einstellungen; ziel=[data-card="spielzeit"])

#### Courts

Rename the courts or pitches, add more with “+ Court” or remove unused ones. With the “Courts” module you can link each to a court of the booking system (free = blocks nothing, e.g. a hall).

![The “Courts” card.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=einstellungen; ziel=[data-card="plaetze"])

#### Block in the booking system

As on the tournament day: the linked courts are blocked between from/to, and beforehand you see the bookings that would be cancelled.

![The “Block in the booking system” card.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=einstellungen; klick=[data-card="sperre"] h3; ziel=[data-card="sperre"])

#### Wall monitor

A link without sign-in, for viewing only. Open it in the browser of the TV: the display switches by itself between running matches with remaining time, next matches, tables, bracket and latest results, large and easy to read, light or dark. On a phone everything is listed one below the other. **Copy address**, **QR code** and **Renew link …** (makes the old link and printed QR codes invalid). The link needs the address of the member app.

#### Tournament director code

Only the tournament director enters results, here in the admin area or on the tablet. On the tablet Clubwerk asks for this code (4 to 6 digits). **Set code** assigns it, **Remove code** takes it back. The code is never shown again, so remember it! Without a code the tablet can only view.

![The “Tournament director code” card.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=einstellungen; klick=[data-card="code"] h3; ziel=[data-card="code"])

#### Finish

- **Cancel draw …:** Deletes groups, matches and schedule as long as nothing has been played. After that you can add teams and draw again.
- **End tournament …:** First you see the placings and open matches. Afterwards winner, runner-up and third place go on the honours board, the block is lifted and results are locked. **Reopen** undoes this.
- **Delete tournament:** Removes teams, schedule and results.

![The “Finish” card.](bild: seite=turnierplaner/turnier/1; tabkey=detail_turnier; tab=einstellungen; klick=[data-card="abschluss"] h3; ziel=[data-card="abschluss"])

## Tablet and app {#tablet-app}

![The “Tournaments” tab on the tablet: today’s tournament, pitches and tables.](bild: tablet=Tournaments; hoehe=620)

![The “Tournaments” section in the member app: your next match and My matches.](bild: app=turniere)

**On the tablet** (tab “Tournaments”, no PIN) you can see the club championship’s tables, knockout stage, play-offs and the honours board. On a tournament day what is happening today appears above them:

- **LK tournament day:** “Check in” (search the name, check in and pay the entry fee in cash or digitally), “Enter result” (tap the match, enter the sets; a result can be entered on the tablet only once, and you enter walkovers and retirements in the admin area) and the courts: tapping one shows the running and the next match, ready to start.
- **Village tournament and other free tournaments:** courts with the running and next match, tables and bracket to look at. “Enter result” and “Start next matches” only work with the **tournament director code** (number pad); it stays valid on the tablet for 15 minutes after the last entry.

**In the member app** (section “Tournaments”, visible to all members while a season exists):

- **Entering:** While entries are open, “I’m in” appears at the top, with ticks for singles and doubles if there is doubles; later “Change entry” or “Log out”. Only members play.
- **Your next match** as a large card, below it **My matches** with their status: open, date set or overdue. The tabs “My matches”, “Tables” and “Knockout stage” also show the play-offs and honours board.
- **Choose a date:** Tap the match, choose a day, then a free time (with “Courts” the court is booked for both players, otherwise you only enter the time). “Move” changes the same booking, “Cancel date” cancels it. The opponent is told every time and can be called or messaged straight from the app (if the member administration knows a number).
- **Enter result:** Set by set, plus “Walkover” and “Retired”. Either player can enter it; only the sports officer can correct it.
- **For me:** Upcoming matches, “Enter result”, “Arrange a date” and open entries also appear under “For me”.
- **Notifications:** new match drawn, deadline in 7 days, result entered, match date arranged, reminder from the sports officer. Every member switches them on individually in the app.

**Without app or account:**

- **Player page at the LK tournament:** The QR code from check-in opens a view-only page with the next match (when, where, against whom), the sequence on the player’s own court and their results. It is valid only for this tournament and until it ends.
- **Team page at the village tournament:** A team’s QR code shows its matches, the table and the knockout stage.
- **Monitor and TV:** See “TV in the clubhouse” (Tournament day) and “Wall monitor” (Tournament planner).

## Permissions {#rechte}

| Permission | What it allows |
|---|---|
| Tournaments | See and edit the pages “Club championship”, “Tournament day” and “Tournament planner”: seasons, draws, results, check-in, creating tournaments, changing settings |

Any member who uses the app can take part. On the tablet viewing needs nothing; entering results at the village tournament needs the tournament director code.

## Working with other modules {#zusammenspiel}

- **Courts:** Club championship players book their court straight from the app (as a club event, without fee or quota). For Tournament day and Tournament planner, Clubwerk blocks courts for the tournament time and cancels bookings, telling the members. If the court administration moves or cancels a booking, the match follows.
- **Members:** For names, the opponent’s phone number and email reminders. A member’s data request lists their entries and matches, and they move along when duplicate members are merged. The member overview shows where someone has entered or has open matches.
- **Start and overview page:** Shows open tournament matches and points out when entry has closed (draw the groups) or matches are overdue.
- **Notifications and member app:** Push messages and the section in the app. The address of the app is needed for QR codes and the monitor.
- **Privacy:** The deletion periods (players from other clubs at the tournament day, player names in the tournament planner) and the record of processing activities are under Settings › Privacy.
