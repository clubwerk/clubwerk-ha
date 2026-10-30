# Courts
<!-- kurz: Book courts and equipment – members use the app or the tablet, and you keep track in the admin area. -->

## What is this module for? {#wofuer}

Members book tennis courts, padel courts, halls or equipment such as the ball machine – in the member app or on the tablet in the clubhouse. Clubwerk looks after opening hours, time grids, maximum duration and each member's quota, knows about playing partners and guests (with a guest fee) and keeps a waiting list. In the admin area you see the occupancy plan, enter training, teams and court blocks, import the fixture list from the league and analyse utilisation.

The module works on its own. Without the Members module it only knows first and last names and has no payment tracking for fees; without Sales, fees cannot be booked to an account by hand.

## Setting up {#einrichten}

1. **Settings › Modules:** switch on “Courts”. With “Demo” you can first try the module with made-up data.
2. **Assign permissions:** under Settings › Users & permissions, give everyone who should help the right permissions (see below), e.g. the groundsman “view occupancy” and “cancel other people's bookings”.
3. **Create courts:** tab “Courts & equipment” › “+ Court” or “+ Equipment”. Set the name, opening hours, time grid and maximum duration.
4. **Check the rules:** tab “Settings” – booking window, quota, guests and guest fee are filled with suggested values. This is also where you create the **booking types** (training, league match …).
5. **Tablet and app:** members see the “Courts” area in the app straight away. On the tablet it appears as soon as “Book on the tablet in the clubhouse” is on (the default).

## Admin area {#verwaltung}

The “Courts” menu has seven tabs: **Occupancy**, **Recurring bookings & blocks**, **Bookings**, **Fees**, **Statistics**, **Courts & equipment** and **Settings**. The “Settings” tab only appears with the permission “Courts: courts, booking types & settings”.

### Tab “Occupancy” {#bk-belegung}

![The occupancy plan for one day: the days of the week at the top, all courts side by side below with their bookings.](bild: seite=bk-belegung; klick=#bkDays button:nth-child(5))

The plan shows who plays on which court and when.

- **Day or week:** the “Day” and “Week” switches toggle between all courts on one day and a single court over seven days (then you pick the court in the bar, and the arrows page by week).
- **Choosing a day:** the days of the week are tiles at the top, the arrows ‹ › page by week, and the date field takes you to any other day. “Today” jumps back.
- **Reading the plan:** each column is a court or an equipment item. A booking is a block in the colour of its booking type; blocks are striped red, times that cannot be booked (outside opening hours) are hatched. The red line is “now”. Today, past hours are folded away – click the bar to unfold them. A legend under the plan explains the colours.
- **Clicking a free slot:** opens “Enter booking” with court, day and time already filled in. You need the permission “book for members”.

![The bar of the week view: choose the court, change the week with the arrows or in the date field.](bild: seite=bk-belegung; klick=#bkV [data-v="woche"]; ziel=.bk-bar)

#### Entering a booking

![The “Enter booking” window: court, date, time, booking type, title and “Who plays”.](bild: seite=bk-belegung; klick=#bkNew; ziel=dialog)

The “+ Booking” button is at the top right.

- **Court / equipment, date, time:** if you change the start, the end moves with it – the duration stays the same.
- **Booking type:** name and colour, e.g. training or league match. You can choose any booking type you are allowed to use. “– none –” is a perfectly normal booking.
- **Title / reason:** optional, e.g. “Junior training”.
- **Member (booking):** who the booking is for. “– Club –” is a club booking (it then needs a booking type or a title). For members, quota and fees apply just as for a booking in the app.
- **Playing partners:** choose from the list; they appear as small cards and can be removed again with ×.

![“More details” unfolded: guests, repeat and internal note.](bild: seite=bk-belegung; klick=#bkNew; klick2=#bdMore; ziel=dialog)

Behind **“More details”** are the rarely used fields:

- **Guests:** names separated by commas. Each guest incurs the guest fee, as an open item on the booking member's account. Ticking “Guests from partner club” waives it.
- **Repeat** and **To:** turns the booking into a recurring one, e.g. every week until the end of the season. Days that are already taken are skipped. You need the permission “create recurring bookings & blocks”.
- **Note (internal):** only visible to users in the admin area.

“Save” enters the booking. If the time is already taken, Clubwerk tells you and enters nothing.

#### Entering a block

![The “Block court” window.](bild: seite=bk-belegung; klick=#bkLock; ziel=dialog)

“+ Block” closes a court for a period, e.g. for maintenance or a tournament. Give court, day, time and reason; “Repeat” turns it into a recurring block. If members already have bookings in that time, Clubwerk asks: with “Block and cancel” they are cancelled and the members are told by email (and push).

> For longer periods such as the winter break, “+ Block over a period” in the tab “Recurring bookings & blocks” is more convenient.

#### Opening a booking

![The opened booking: players, fee, note and who entered it and when.](bild: seite=bk-belegung; klick=.bk-blk.buchung; ziel=dialog)

Clicking a block shows the details: players, title, fee, note and who entered the booking, when and where (app, tablet, admin area, schedule import).

- **Cancel** asks for a reason (optional). The member receives an email and any fee is dropped. You need the permission “cancel other people's bookings”.
- **Edit** opens the same window as when entering a booking: court, time, member, playing partners, guests and booking type can be changed. Guest fees are recalculated, and new playing partners receive the email.

If the date belongs to a recurring booking or block, Clubwerk first asks what you mean:

![The choice for recurring dates: only this date, this and all following, entire series.](bild: seite=bk-belegung; klick=#bkDays button:nth-child(2); klick2=.bk-blk.serie; klick3=#bxE; ziel=#askBox)

When cancelling, a confirmation follows before anything disappears. When editing (court, time, title, booking type, note), “Check” first shows how many dates are affected and on which days the court is taken.

### Tab “Recurring bookings & blocks” {#bk-serien}

![The tab “Recurring bookings & blocks” with the active series, blocks and fixture lists.](bild: seite=bk-serien)

All recurring dates are listed here: training, courses, team matches and blocks. Each line gives the title, repetition (“every Tuesday”), time, period, courts, who it concerns and how many dates are still to come. “End” (for blocks “Lift”) removes the upcoming dates after a confirmation; past ones stay. Ended series are listed below. The buttons at the top need the permission “create recurring bookings & blocks”.

#### + Recurring booking

![The “New recurring booking” window.](bild: seite=bk-serien; klick=#srNew; ziel=dialog)

A recurring booking reserves courts regularly, e.g. “Men's training” every Tuesday 7–9 pm on courts 1 and 2.

- **Booking type** and **Title:** without a title, the series is named after the booking type or the member.
- **First day, Last day, Courts:** the period and the courts (several are possible).
- **Repetition:** daily, weekly, every 2 to 4 weeks or monthly – on the same day (e.g. the 15th of every month) or on the same weekday (e.g. the 2nd Tuesday). For weekly you pick the **weekdays**.
- **Start, End** and optionally **Member / coach.**

“Check” first shows how many dates will be created and on which days the court is already taken (those days are skipped). Only “Create recurring booking” enters them.

#### + Block over a period

![The “Block over a period” window.](bild: seite=bk-serien; klick=#srLock; ziel=dialog)

Built like the recurring booking, but without a booking type: spring court maintenance, the winter break, a tournament weekend. The preview shows which member bookings are affected – they are cancelled with “Block” and the members are informed.

#### Import schedule

![The “Import schedule” window: paste a table or choose a file.](bild: seite=bk-serien; klick=#srImp; ziel=dialog)

The teams' home matches land in the occupancy plan without any typing.

1. On the league's website (e.g. nuLiga “Matches”), select the table, copy it and paste it into the field. Or choose a file: CSV, Excel or calendar (.ics, e.g. from fussball.de).
2. “Read in”. In the “Check schedule” window, your club name is at the top (“home match” is based on it) together with a booking type. Below, for each team, the courts and the duration – Clubwerk suggests them from the league (“6-player” = three courts, five hours) and remembers your settings. In the list of matches, new home matches are ticked; matches without a time, past ones and those already entered are greyed out.
3. “Check” shows how many matches are new or rescheduled, which member bookings clash with match times (they will be cancelled) and whether simultaneous matches were spread over other courts. Then “Apply”.

A later import recognises rescheduled matches and moves them. If the Match play module is switched on, it also takes over the away matches as match days.

### Tab “Bookings” {#bk-protokoll}

![The tab “Bookings”, filtered here to “With guest”: filters, search, year, court and the list.](bild: seite=bk-protokoll; klick=#lgF [data-f="gast"])

The log of all bookings in a year, including cancelled ones and blocks, grouped by day. The columns:

| Column | Content |
|---|---|
| Players / booking type | The players with photo or initials; for club bookings the title or booking type. The coloured stripe on the left is the colour of the booking type |
| Court | Court or equipment, plus small tags for booking type, block, series, guests and fee |
| Date | Time and day |
| Status | Upcoming, Running now, Locked or Cancelled (with who, when and why) |
| Entered | When, and via app, tablet or admin area |

- **Filters:** All · Members · With guest · Booking types · Blocks · Cancelled.
- **Search** by name, court or booking type; **year**, **court** and **sorting** (by date or by entry date) below it.
- **Excel** (top right) downloads the filtered list as a spreadsheet.
- Clicking a row opens the booking as in the occupancy plan, with Cancel and Edit. 200 entries are shown at first, “Load more” fetches more.

### Tab “Fees” {#bk-gebuehren}

![The tab “Fees” with three totals and the list of fees.](bild: seite=bk-gebuehren)

All guest and court fees from bookings, plus fees booked by hand. At the top are the totals **Open**, **Paid** and **Total** for the year, below them the list (member, date, court, text, amount, status). Use the filters “All / Open / Paid” and the year selector to narrow it down.

Fees arise when booking, as open items, and are settled with the next collection. Clubwerk takes the payment status from Fees & payments › Open items. Without the Members module it says “without payment tracking” and the fees are only listed. Clicking a row opens the booking it belongs to.

#### + Book fee

![The “Book fee” window.](bild: seite=bk-gebuehren; klick=#feNew; ziel=dialog)

For a fee without a booking, e.g. a hall rental: person, amount (between €0.10 and €1,000), date and text. For members this creates a claim that is collected like a membership fee. For coaches (“Not a member”) the amount goes to the sales account. You need the permission “book for members”.

Fees booked by hand have a **Cancel** button in their row; the confirmation names the amount, and the open item is withdrawn.

### Tab “Statistics” {#bk-auswertung}

Utilisation compared year on year. At the top you choose the **year** and the **court**; everything is compared with the previous year (green better, red worse). In the current year, utilisation counts up to today.

#### Key figures

Four tiles: **Booked hours**, **Utilisation** (booked time in relation to bookable time, blocks excluded), **Bookings** and **Cancelled**. The curve shows the twelve months, with the previous year dashed.

![The four key figures with curve and comparison with the previous year.](bild: seite=bk-auswertung; ziel=.bk-kpis)

Below are the highlights: peak time, most popular day, most popular court and the average duration and lead time of a booking.

![The highlights of the year.](bild: seite=bk-auswertung; ziel=.bk-hl)

#### Utilisation per court and usage

On the left, the utilisation of each court (the line marks the previous year), and below it how many players, bookings with guests and bookings with a booking type there were. On the right, the ring shows what the courts are used for: normal bookings, training, league matches …

![Utilisation per court and usage by type and booking type.](bild: seite=bk-auswertung; ziel=.bk-two)

#### Year calendar, months, ranking

The year calendar colours each day by booked hours (the darker and redder, the more). Below it, bars show the hours per month against the previous year, and “Who plays the most?” gives the ranking of players.

![The year as a calendar: each square is one day.](bild: seite=bk-auswertung; ziel=.bk-heatwrap)

#### When do people play?

One circle per weekday and hour: the bigger and darker, the more hours booked during the year. This helps with opening hours and with planning training.

![“When do people play?”: size and colour show the booked hours per weekday and time.](bild: seite=bk-auswertung; klick=.bk-bub > .bc:last-child; ziel=.bk-bub)

### Tab “Courts & equipment” {#bk-plaetze}

![The tab “Courts & equipment” with name, bookable times, grid, guest fee and upcoming bookings.](bild: seite=bk-plaetze)

Everything that can be booked. Each row of the list shows the name and area (notes such as “partner required” or the department are underneath), **Bookable** (days and times), **Grid** (time grid and maximum duration), **Guest fee** and the number of **upcoming** bookings. With **↑ ↓** you set the order – this is how courts appear in the plan, in the app and on the tablet. New courts go to the end. Everything here needs the permission “Courts: courts, booking types & settings”.

![The window for editing a court.](bild: seite=bk-plaetze; klick=[data-ed]; ziel=dialog)

#### + Court and + Equipment

Both open the same window, which “Edit” also opens for an existing court:

- **Name** and **Area:** the area is the tab in the app, e.g. “Tennis” and “Padel”. All courts of an area are shown side by side.
- **Type:** court or equipment.
- **Bookable on** (weekdays), **From / To** (opening hours).
- **Time grid:** the steps in which bookings are made (15 minutes to 2 hours).
- **Maximum duration at a stretch** (up to 8 hours).
- **Quantity:** for equipment, how many can be booked at the same time (two ball machines = 2).
- **Guest fee per guest:** empty = the default from the settings.
- **Note for members:** shown when booking, e.g. “Clay – please drag the court after play”.
- **Belongs to department** (appears as soon as there are departments): members of the department book for free; for **other members** you choose “book with court fee” (amount per person) or “may not book”.
- **Active:** inactive courts cannot be booked and are not in the plan.

Only for **courts**: **Playing partners** “optional” or “required”, and **Solo practice allowed, label** (e.g. “Ball wall”; empty = no). Only for **equipment**: **Bookable as partner** – e.g. the ball machine, which is chosen as a “partner” when booking and booked for the same time slot.

“Delete” only works if there are no more upcoming bookings, recurring bookings or blocks on the court; past ones stay in the log and in the statistics. Otherwise set the court to “inactive”.

### Tab “Settings” {#bk-einstellungen}

The rules for booking, organised in cards. **Each card has its own “Save”.** You need the permission “Courts: courts, booking types & settings”.

#### Book

Three numbers and one choice:

- **Booking window (days in advance):** how far ahead members may book (default 7).
- **Open court bookings per member** and **Open equipment bookings per member:** the quota – how many upcoming bookings someone may have at the same time (default 2). This stops anyone blocking all the courts.
- **Cancel until … before the start:** until the start, 1, 2 or 6 hours or 1 day before. This applies to members in the app and on the tablet; the admin area can always cancel.

Club bookings (training, league matches) ignore the booking window and quota, see “Booking types”.

![Card “Book”: booking window, quota and cancellation deadline.](bild: seite=bk-einstellungen; ziel=[data-card="buchen"])

#### Players & guests

- **Playing partners at most**, **Guests at most** per booking.
- **Guest fee per guest (default):** applies where the court has none of its own. It is an open item on the booking member's account and is dropped if the booking is cancelled.
- **Partners count towards the quota:** whoever plays along cannot book at the same time themselves.
- **Playing partners get an email** when they are added.

![Card “Players & guests”.](bild: seite=bk-einstellungen; ziel=[data-card="mitspieler"])

#### Waiting list

If it is on, a member can join the waiting list for a taken time and receives an email (and push) as soon as it becomes free – the app then shows “Court became free” with a note to book quickly. **Entries per member** limits the number of waiting-list entries (default 3). If the waiting list is off, only the switch remains.

![Card “Waiting list”.](bild: seite=bk-einstellungen; ziel=[data-card="warteliste"])

#### Who may book?

With the Members module you decide here who may book – the person booking **and** all playing partners:

- **Membership:** active, honorary member, passive / supporting, dormant (default: active and honorary member).
- **Fee types that may not book:** e.g. “Supporting member”.

The admin area can always book for anyone.

**Special rights in the member app** apply to individual members, e.g. coaches. Below the card is the list of members and their rights; the pencil and the bin change or withdraw them.

![Card “Who may book?” with membership, fee types and special rights.](bild: seite=bk-einstellungen; ziel=[data-card="wer"])

With **“+ Special right”** you choose a member and allow them in the app to:

- **create recurring bookings** (weekly for up to a year; dates that are taken are skipped),
- **book for others** (e.g. for a member without a phone; quota, rules and fees then apply to that member),
- **book with all booking types** (including future ones) or only with those you tick,
- for coaches (“Not a member”): **book the courts of certain departments**, without fees and quota.

Changes take effect immediately and do not need to be saved.

![The “Grant special right” window.](bild: seite=bk-einstellungen; klick=#rtNew; ziel=dialog)

#### Booking types

A booking type marks club bookings with a name and colour, e.g. training, league match, course, tournament or court maintenance. The list shows the name, **who may use it** and the number of upcoming dates. “Edit” opens the window, “+ New booking type” creates a new one.

![Card “Booking types”: name, who may book and upcoming dates.](bild: seite=bk-einstellungen; klick=#lbList tr:last-child td:first-child; ziel=[data-card="arten"])

#### Creating and editing a booking type

In the window you set:

![The “New booking type” window with colour, preview and the choice of who may use it.](bild: seite=bk-einstellungen; klick=#lbNew; klick2=#lbU [data-u="auswahl"]; ziel=dialog)

- **Name**, **Order**, **Colour** (20 colours or “Custom”) with a **Preview.** The text adapts to the colour so that it stays readable.
- **Who may book with this booking type?**
  - *Admin only:* members do not see it in the app.
  - *All members:* everyone who may book can choose it in the app (e.g. “Club championship”).
  - *Specific roles & people:* only members with one of the chosen roles (from the Members module, e.g. “Coach”) or individually chosen people.
- **Club booking:** no maximum duration, quota, booking window or fees – e.g. a league match lasting five hours, booked three weeks ahead, opponents as guests without a guest fee.
- **Active:** inactive booking types can no longer be chosen; existing dates keep them.
- **Delete** only works while the booking type is not in use; otherwise set it to “inactive”.

#### Tablet & member app

- **Book on the tablet in the clubhouse:** name and PIN are enough, and the rules are the same as in the app. Off: the tablet shows the plan, but booking is only possible in the app.
- **Names in the occupancy visible to all members:** off: members only see “taken”.
- **Show “On court now” in the app:** the line above the plan showing who is playing right now and who is coming next.

Booking from elsewhere works as soon as the member app can be reached from outside (Club › Member app).

![Card “Tablet & member app”.](bild: seite=bk-einstellungen; klick=[data-card="app"] h3; ziel=[data-card="app"])

#### Court rules

A text (e.g. “Please play in tennis shoes only”) that is shown before every booking and must be confirmed by ticking “I will follow the court rules”. Leave it empty if you do not need any.

![Card “Court rules”.](bild: seite=bk-einstellungen; klick=[data-card="ordnung"] h3; ziel=[data-card="ordnung"])

#### Transfer settings

Export courts, booking types and settings as a file and import them into another Clubwerk installation, e.g. for a second club or after a reinstall (without bookings, PINs and passwords). On import, entries with the same name (ignoring upper/lower case) are updated, new ones are created and nothing is deleted. The message says for each kind how many were new and how many were updated.

![Card “Transfer settings”.](bild: seite=bk-einstellungen; klick=#bkFunc h3; ziel=#bkFunc .card)

## Tablet and app {#tablet-app}

![The “Courts” area in the member app, here with tomorrow's free times.](bild: app=buchung; klick=.vh-days button:nth-child(2); klick2=.bkm-view [data-v="zeiten"])

![The “Courts” tab on the tablet in the clubhouse.](bild: tablet=Courts; hoehe=560)

**In the app** (area “Courts”) the member's own next booking is shown large at the top (“Change” opens it). Below, the member picks a day up to the booking window, an area if there are several (e.g. tennis and padel) and a view: **Free times** (one row per time, one box per court), **Compact** (all courts side by side) or **Detailed** (wide columns with full names, swipe sideways; the phone remembers the choice). A line “On court now” shows who is playing right now.

- **Booking:** tap a free slot, choose the duration (only up to the next booking or the maximum duration), and if you like add playing partners, guests (by name; ticking “Member of a partner club” saves the fee) or equipment (“ball machine”) or “solo” (e.g. ball wall). Anyone with the special right can also book for another member or repeat. A price field shows the guest fee and any court fee in advance; then confirm the court rules and tap “Book”.
- **Tapping a taken time:** shows who has booked (depending on the setting) and offers “Join waiting list”.
- **My bookings:** with icons for calendar (the booking goes into the phone's calendar), change and cancel; below it “My series” with “End” and “Waiting list” with “Remove”.
- **Push:** members can be notified when they are added as a playing partner, when a booking is changed or cancelled (also because of a court block), when a court from the waiting list becomes free and shortly before the match (2 hours ahead, adjustable). The board decides which occasions exist under Member app › Notifications.
- If a member is barred (their membership or fee type may not book), a note at the top tells them to contact the board.

**On the tablet** (tab “Courts”) you see the same plan. Tap a free slot, search for your own name (from two letters on), enter your **PIN** and book; anyone without a PIN sets one right there. Tapping a booking and “Cancel” also needs the PIN. For recurring bookings the tablet asks: “Only today”, “Today and all following” or “Entire series”. As in the app, further days up to the booking window can be chosen above the plan; after 2 minutes without input the tablet jumps back to today.

## Permissions {#rechte}

| Permission | What it allows |
|---|---|
| Courts: view occupancy | View occupancy, bookings, fees and statistics |
| Courts: book for members, single bookings with booking type | Enter and edit bookings and blocks, book and cancel fees by hand |
| Courts: cancel other people's bookings | Cancel bookings and blocks |
| Courts: create and end recurring bookings & blocks | Recurring bookings, blocks and schedule import; repeating in the booking window |
| Courts: courts, booking types & settings | Tabs “Courts & equipment” and “Settings” with booking types and special rights |

Members and coaches book in the app and on the tablet without any admin permission. Someone who may only view the occupancy sees the plan but cannot enter anything.

## Working with other modules {#zusammenspiel}

- **Members:** names, membership, fee types and roles come from there, as do the payment status and collection of fees (Fees & payments › Open items). When duplicate members are merged, bookings, recurring bookings, waiting list and fees move with them. When a member is deleted, the waiting list entries are dropped and their recurring bookings carry on as club bookings; past bookings remain as history. A member's data report includes their bookings, fees, waiting list and special rights. The corresponding record appears under Settings › Privacy.
- **Sales:** fees for coaches, and fees without the Members module, go to the sales account and are settled there.
- **Match play:** the schedule import also passes matches on to Match play (match days, teams).
- **Tournaments:** the module books the courts for matches (club championship) and blocks them on tournament days – with a preview of which bookings are affected. Tournament matches are club bookings without a fee.
- **Faults:** courts and equipment appear there automatically as locations.
- **Setup and overview:** the setup assistant walks you through “Create courts” and “Rules for booking”. The overview shows open fees and today's bookings.
- **Member app:** “For me” shows the member's own next bookings, courts that became free from the waiting list and bookings cancelled by a court block.
