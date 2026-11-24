# Courts
<!-- kurz: Book courts and equipment – members use the app or the tablet, and you keep track in the admin area. -->

## What is this module for? {#wofuer}

Members book tennis courts, padel courts, halls or equipment such as the ball machine – in the member app or on the tablet in the clubhouse. Clubwerk looks after opening hours, time grids, maximum duration and each member's quota, knows about playing partners and guests (with a guest fee) and keeps a waiting list. With the partner search, members find players from the club in the app and get from a request to a booking with one tap. In the admin area you see the occupancy plan, enter training, teams and court blocks, import the fixture list from the league and analyse utilisation.

The module works on its own. Without the Members module it only knows first and last names and has no payment tracking for fees; without Sales, fees cannot be booked to an account by hand.

## Setting up {#einrichten}

1. **Settings › Modules:** switch on “Courts”. With “Demo” you can first try the module with made-up data.
2. **Assign permissions:** under Settings › Users & permissions, give everyone who should help the right permissions (see below), e.g. the groundsman “view occupancy” and “cancel other people's bookings”.
3. **Create courts:** tab “Courts & equipment” › “+ Court” or “+ Equipment”. Set the name, opening hours, time grid and maximum duration.
4. **Check the rules:** tab “Settings” – booking window, quota, guests and guest fee are filled with suggested values. This is also where you create the **booking types** (training, league match …).
5. **Tablet and app:** members see the “Courts” area in the app straight away. On the tablet it appears as soon as “Book on the tablet in the clubhouse” is on (the default).
6. **Guest booking (optional):** if non-members should also book online and pay with PayPal or card, set up the booking page – step by step in the “Guests” tab below.

## Admin area {#verwaltung}

The “Courts” menu has eight tabs: **Occupancy**, **Recurring bookings & blocks**, **Bookings**, **Fees**, **Statistics**, **Partner search**, **Courts & equipment** and **Settings**. The “Settings” tab only appears with the permission “Courts: courts, booking types & settings”.

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

- **Cancel** asks for a reason (optional). The member receives an email and any fee is dropped. You need the permission “cancel other people's bookings”. You find it in the details and also in the “Edit” window (“Cancel” button at the bottom left).
- **Edit** opens the same window as when entering a booking: court, time, member, playing partners, guests and booking type can be changed. Guest fees are recalculated, and new playing partners receive the email.
- **Court code “Show”** (only on courts with gates, with the permission “book for members” or “Series & blocks”): shows the code for the keypad at the gate, e.g. to pass it on to a team without the app. Every view is recorded in the change log (without the code).

If the date belongs to a recurring booking or block, Clubwerk first asks what you mean:

![The choice for recurring dates: only this date, this and all following, entire series.](bild: seite=bk-belegung; klick=#bkV [data-v="woche"]; klick2=.bk-blk.serie; klick3=#bxE; ziel=#askBox)

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

All guest and court fees from bookings, plus fees booked by hand. At the top are the totals **Open**, **Paid** and **Total** for the financial year (usually the calendar year, otherwise e.g. “2026/27”), below them the list (member, date, court, text, amount, status). Use the filters “All / Open / Paid” and the year selector to narrow it down.

Fees arise when booking, as open items, and are settled with the next collection. Clubwerk takes the payment status from Fees & payments › Open items. Without the Members module it says “without payment tracking” and the fees are only listed. Clicking a row opens the booking it belongs to.

#### + Book fee

![The “Book fee” window.](bild: seite=bk-gebuehren; klick=#feNew; ziel=dialog)

For a fee without a booking, e.g. a hall rental: person, amount (between €0.10 and €1,000), date and text. For members this creates a claim that is collected like a membership fee. For coaches (“Not a member”) the amount goes to the sales account. You need the permission “book for members”.

Fees booked by hand have a **Cancel** button in their row; the confirmation names the amount, and the open item is withdrawn. If the fee has already been collected or paid, you cancel it in Members (choosing “keep as credit” or “transferred back”). A booking whose fee has been paid can no longer be edited, only cancelled – the fee then stays and the log notes “Fee not cancelled”.

Fees for a family member or someone with their own payer (“pays for”) appear as an open item with the payer.

### Tab “Guests” {#bk-gaeste}

![The “Guests” tab: connection to the booking page, key figures, discrepancies and the guest bookings.](bild: seite=bk-gaeste; hoehe=620)

This is where courts are booked by **non-members**. Guests book on a small separate booking page (as a link or a frame on your website) and pay with **PayPal or debit/credit card**. The booking page runs outside the clubhouse at Cloudflare. Clubwerk stays unreachable from outside: about once a minute it calls the booking page itself, sends the free times and collects new bookings and cancellations. The booking page knows no member data.

Clubwerk then checks every payment **itself at PayPal** (paid, amount, euro, booking number). Only then does the booking appear in the occupancy plan as “Guest booking”, get a court code for the gate, and the guest receive a confirmation email with the code and a cancellation link. While the guest is paying at PayPal, Clubwerk holds the time as “Guest booking (payment in progress)” so nobody books it in the meantime.

At the top you see whether the connection works: **connected** (green, with the time of the last sync and “PayPal sandbox” or “PayPal live”), **no connection** (internet down – guests cannot book, everything else in Clubwerk keeps working), **vault locked** (after a restart syncing waits until an admin signs in; what is waiting is listed below) or an error such as “signature” (key does not match) or “PayPal environment does not match”. **Sync now** syncs straight away, **Set up** opens the setup window, **Embed on the website** shows the link and the code for the frame.

Below are three key figures: **upcoming guest bookings**, **income this month** (minus refunds, with the number of bookings; the PayPal fee is shown in each guest booking) and **open discrepancies**.

#### Discrepancies

![Card “Open discrepancies” with “Enter anyway” and “Done”.](bild: seite=bk-gaeste; ziel=[data-card="abweichungen"])

This lists everything that does not match for a payment – for example a different amount at PayPal, a payment that does not exist at PayPal, or, in the **daily check** with PayPal (last 3 days), a payment without a guest booking in Clubwerk. Clubwerk does not enter a booking with a discrepancy; the court stays held until you decide:

- **Enter anyway** (only for “please check”): Clubwerk checks once more at PayPal that it is paid and enters the booking despite the different amount – e.g. shortly after a price change. If the amount at PayPal itself is wrong, Clubwerk refuses.
- **Cancel** in the guest booking (see below) refunds the money.
- **Done** hides the discrepancy once you have cleared it up. This is logged.

If there are discrepancies, the overview shows a red notice too.

#### Guest bookings

![The list of guest bookings with filter, name, time, court, booking number, amount and status.](bild: seite=bk-gaeste; ziel=#bkBody > .card:has(table.bk-fees))

The filters **Upcoming**, **All**, **Cancelled** and **With discrepancy** narrow the list. Names are shown as “Last name, First name”. The status is **Payment in progress** (guest is at PayPal right now), **Payment under review** (PayPal is still checking the payment – the court is held, the code comes afterwards), **paid** (with court code if the court has gates), **Refund in progress**, **cancelled**, **aborted**, **Court was taken** (the time was already taken in Clubwerk – nothing charged or money refunded) or **please check**.

Click a row to open the guest booking:

![The opened guest booking with contact, amount, PayPal numbers and “Cancel and refund”.](bild: seite=bk-gaeste; klick=tr[data-g]; ziel=dialog)

You see email and mobile number, amount and PayPal fee, the numbers at PayPal and which email the guest received. Viewing is logged. **Cancel and refund** with a reason (it is included in the email to the guest): the booking page refunds the amount via PayPal, Clubwerk checks the refund, removes the booking, makes the court code invalid and emails the guest. The same happens if you cancel a guest booking in the occupancy plan or a block pushes it out. A guest booking cannot be moved – the guest paid for exactly this time.

Guests cancel themselves using the link in their confirmation, up to the cancellation deadline (default 24 hours before the start). After that, only you can cancel.

#### Courts for guests

![Card “Courts for guests”.](bild: seite=bk-gaeste; ziel=[data-card="plaetze"])

For each court you decide whether guests may book it online. **Edit** opens the window:

![The window for a court: bookable by guests, weekdays, time window, price per hour, length and booking window.](bild: seite=bk-gaeste; klick=[data-gc="3"]; ziel=dialog)

- **Bookable online by guests (non-members)** releases the court.
- **Weekdays** and **From/To**: guests only see free times within this window and within the court’s opening hours.
- **Price per hour** (€1 to €500) and **Length per booking** (in the court’s grid): the price of a booking is price per hour × length.
- **Booking window**: how many days in advance the court can be booked (1 to 60). Times starting in less than 30 minutes are no longer offered.

Times that are taken – members, recurring bookings, blocks, tournaments – are never offered on the booking page.

#### Setting up

![The window “Set up guest booking”: booking page, website, deadlines and privacy notice.](bild: seite=bk-gaeste; klick=#gsCfg; ziel=dialog; hoehe=640)

- **Guest booking switched on**: without the tick the booking page shows “no online bookings”.
- **Address of the booking page** (`https` only), **Website where it may be embedded** (the frame only shows there), **Legal notice** and **Privacy policy** (links at the bottom of the booking page).
- **Cancel with refund up to … hours before** (0 to 720) and **Time reserved while the guest pays** (5 to 30 minutes).
- **Privacy notice**: shown on the booking page before payment. **Insert suggestion** fills in a text with purpose, legal basis, PayPal and Cloudflare, deletion periods and rights – please adapt it to your club and have your data protection officer check it. **Show club logo** sends the logo to the booking page.
![At the bottom of the window: shared key and PayPal access for checking payments.](bild: seite=bk-gaeste; klick=#gsCfg; ziel=#gsZugang)

- **Shared key**: **Create key …** (with your password) shows the key **only once** for copying; afterwards it only says “saved”. It belongs on the booking page (see below). A new key triggers a security warning; until it is also on the booking page, guest booking pauses.
- **PayPal (app “Clubwerk Prüfung”)**: **Environment** sandbox (test) or live (real money), **Client ID** and **Secret** of this app. Clubwerk uses them **read-only** (looking up payments, daily check), never to charge or refund. The secret is stored encrypted in the vault and never shown. **Check PayPal** tests the access with the check of the last 3 days. Switching to live asks for confirmation and triggers a security warning.

#### Embed on the website

![The window “Embed on the website” with link and frame.](bild: seite=bk-gaeste; klick=#gsEmbed; ziel=dialog)

Either just put the **link** on your website or paste the **frame** (iframe) together with the small script for the height (**Copy frame**). On a phone, “Continue to booking” opens the booking page full-screen and redirects to PayPal for payment – without a popup.

#### Step by step: setting up the booking page and the PayPal sandbox

First set everything up in the **PayPal sandbox** (test money). Only switch to live once everything works and the board has agreed. You need: a free Cloudflare account, a PayPal developer login (sign in with the club’s PayPal business account), a PC with Node.js 22 (Windows, Mac or WSL) and the **gaestebuchung** folder from the Clubwerk package.

1. **PayPal app “Buchungsseite”:** <https://developer.paypal.com> → sign in → **Apps & Credentials** → choose **Sandbox** at the top → **Create App**, name “Buchungsseite”, type *Merchant*. Note the client ID and secret – they go on the booking page.
2. **PayPal app “Clubwerk Prüfung”:** create another app with the same sandbox business account and switch on **Transaction Search** under *Features*. The client ID and secret of this app go **only** into Clubwerk.
3. **Create the key:** in Clubwerk under Courts › Guests › **Set up**, click **Create key …** and copy the key.
4. **Prepare Cloudflare:** on the PC open a command prompt in the `gaestebuchung` folder and enter `npx wrangler login` (opens the Cloudflare sign-in in the browser).
5. **Create the database:** `npx wrangler d1 create gaestebuchung` – enter the `database_id` shown in the file `wrangler.toml`, then `npx wrangler d1 migrations apply gaestebuchung --remote`.
6. **Enter the client ID:** in `wrangler.toml` put the client ID of the app “Buchungsseite” at `PAYPAL_CLIENT_ID`. `PAYPAL_ENV` stays `"sandbox"`.
7. **Secrets only by command:** `npx wrangler secret put PAYPAL_CLIENT_SECRET` (secret of the app “Buchungsseite”) and `npx wrangler secret put CLUBWERK_SCHLUESSEL` (key from step 3). These values never go into a file.
8. **Security check (Turnstile) against mass reservations:** in the Cloudflare dashboard choose **Turnstile** on the left › *Add widget*: name “Buchungsseite”, as hostnames the address of the booking page (e.g. `gaestebuchung.dein-verein.workers.dev` and, if set up, `buchen.dein-verein.de`), mode *Managed*. Enter the **Site Key** in `wrangler.toml` at `TURNSTILE_SITE_KEY` and the **Secret Key** with `npx wrangler secret put TURNSTILE_SECRET`. Before paying, guests see a small “I am human” box that usually ticks itself. Without these keys the booking page accepts no reservations.
9. **Upload:** `npx wrangler deploy` – at the end the address is shown, e.g. `https://gaestebuchung.dein-verein.workers.dev`. You set up your own address such as `buchen.dein-verein.de` at Cloudflare under *Workers › gaestebuchung › Settings › Domains & Routes*.
10. **Webhook at PayPal:** in the app “Buchungsseite” under *Webhooks* → *Add Webhook* → address `https://<your-address>/api/v1/webhook`, events *Checkout order approved* and *Payment capture completed, denied, pending, refunded, reversed*. Enter the **Webhook ID** in `wrangler.toml` at `PAYPAL_WEBHOOK_ID` and run `npx wrangler deploy` again.
11. **Connect Clubwerk:** in the **Set up** window enter the address of the booking page, your website, legal notice and privacy policy, environment **Sandbox** and the client ID and secret of the app “Clubwerk Prüfung”, tick **Guest booking switched on** and save. **Sync now** must show “connected”.
12. **Release courts:** in the card “Courts for guests” click **Edit** for each court and switch on “bookable by guests”.
13. **Try it out:** open the booking page, book a time and pay with a sandbox buyer (developer.paypal.com → *Testing Tools* › *Sandbox Accounts*, type *Personal*; test cards under *Card Testing*). Within a minute the booking is in the occupancy plan and the confirmation is in the mailbox.

> Switching to live: choose **Live** at the top of developer.paypal.com and create both apps there again, in `wrangler.toml` set `PAYPAL_ENV = "live"` and the new client ID and webhook ID, run `npx wrangler secret put PAYPAL_CLIENT_SECRET` with the live secret, `npx wrangler deploy`, and in Clubwerk choose environment **Live** with the live app “Clubwerk Prüfung”. If the environments do not match, Clubwerk stops syncing.

> PayPal charges a fee per payment (in Germany about 2.49 % + €0.35, less for non-profit clubs on application). On a refund PayPal keeps the fixed part. Clubwerk records both in the bookkeeping (payment method PayPal).

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

### Tab “Partner search” {#bk-mitspieler}

![The “Partner search” tab with the open requests.](bild: seite=bk-mitspieler; hoehe=460)

In the app, under Courts › Playing partners, members post **requests** (“Doubles, Thu 18:00–20:00, court 3 already booked”). Here you see all requests with member, format and playing level, date and court, replies (“2 of 3” with names) and status. The filters **Open** (including full ones), **Reported**, **Done** (court booked) and **Ended** (withdrawn, expired, hidden) narrow the list. A request ends at its start time or when the linked booking is cancelled.

#### View, hide or block a request

![A request with “Hide” and “Block member from the partner search”.](bild: seite=bk-mitspieler; klick=tr[data-ms]; ziel=dialog)

Click a row to see the request with its note, replies and reports. Members can **report** a request in the app; reported requests appear as a note in the overview. **Hide** removes the request from the app (“Show again” undoes it). **Block member from the partner search** hides their open requests; they can no longer post requests or reply, but can still book. Both need the permission “Courts: cancel other people's bookings” and are recorded in the log.

![The card “Blocked from the partner search”.](bild: seite=bk-mitspieler; ziel=[data-card="ms-gesperrt"])

The card **Blocked from the partner search** lists blocked members; “Lift block” lets them take part again.

#### Partner search settings

![The partner search settings.](bild: seite=bk-mitspieler; ziel=[data-card="ms-einstellungen"])

The tick switches the partner search in the app on or off. Then there are the limits **Open requests per member** (default 3) and **Replies per member and day** (default 10), the **formats** (one per line with the number of players wanted, e.g. “Doubles: 3” or “Training: 1–3” to choose from) and the **playing levels** from low to high (default Beginner, Casual, Team, Tournament). This way the partner search also fits padel, badminton or table tennis. There is no restriction by age.

> Requests and replies are deleted 90 days after the date; you set the period under Settings › Data protection.

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

Only for **courts** (as soon as the Access module is on): **Court code opens these gates** – the doors with a keypad from the Access module that the code of a booking on this court opens, usually the main gate and exactly this court’s gate. One gate can serve several courts. Only users who also have the “Access” permission may change this; every change is logged and the board receives a security warning. Without gates, the court gets no code.

![In a court’s window: which gates the court code opens.](bild: seite=bk-plaetze; klick=[data-ed="4"]; ziel=#dialog .bkf:has([data-cd]))

Also only for **courts**: **Playing partners** “optional” or “required”, and **Solo practice allowed, label** (e.g. “Ball wall”; empty = no). Only for **equipment**: **Bookable as partner** – e.g. the ball machine, which is chosen as a “partner” when booking and booked for the same time slot.

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

#### Court code

The card appears as soon as the Access module is on. Every booking on a court with gates – including every single date of a series or training – gets its own random 6-digit code. **Code valid from … before the start** (default 15 minutes) until the booking ends; after the end it no longer opens from outside (the thumb turn inside always opens). If the booking is moved, the time window moves with it. If it is cancelled, the code stops working at once. If someone is removed or the court is changed, there is a new code.

![“Court code” card.](bild: seite=bk-einstellungen; ziel=[data-card="platzcode"])

Only those involved see the code: the booker and the playing partners in the app and in the playing-partner email, for series the assigned coach in the app, and the booker on the tablet after booking (plus a short email with the code). Guests have no address of their own in Clubwerk – the booker passes the code on to them.

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
- **Court code:** after booking, the app shows the code in large digits (“Court code for the gate”, with validity and gates); under “Court codes for the gate” (below “My bookings”) you find the codes of all your bookings for today and tomorrow, as a playing partner too, and for coaches those of their series dates – court and time on the left, the code on the right.
- **My bookings:** with icons for calendar (the booking goes into the phone's calendar), change and cancel (also at the very bottom of the “Change booking” window: “Cancel booking”); below it “My series” with “End” and “Waiting list” with “Remove”.
- **Cancelling as a playing partner:** every playing partner entered on a booking can cancel the whole booking, with the same deadline as the person who booked it (“…'s booking will be cancelled for everyone.”). Only the person who booked can change it. Any fee is dropped just as when the booker cancels; the booker and the other playing partners receive an email and a push notification, and the log shows who cancelled. Anyone who neither booked nor plays sees “Booked by … – only they or a playing partner can cancel.”
- **Push:** members can be notified when they are added as a playing partner, when a booking is changed or cancelled (also because of a court block), when a court from the waiting list becomes free and shortly before the match (2 hours ahead, adjustable). The board decides which occasions exist under Member app › Notifications.
- If a member is barred (their membership or fee type may not book), a note at the top tells them to contact the board.

![The “Playing partners” tab in the app: own request, replies and open requests.](bild: app=buchung; klick=.bkm-tabs [data-tab="ms"])

![The “Find players” window.](bild: app=buchung; klick=.bkm-tabs [data-tab="ms"]; klick2=#bkmMsNew)

**Playing partners (tab at the top of the “Courts” area):**
- **Find players:** choose the format (for “Training” also how many), then one of your own bookings or “no court yet” with day and time. Playing level, LK range and a note (up to 140 characters, no links) are optional. “Post request” posts it. Only members allowed to use “Courts” in the app can see it – with “Last name, first name” and photo (if shared for court booking), never with phone number or email.
- **I'm in:** the reply is binding, first come, first served. If the request has a court, you are added to the booking as a player straight away (with the same rules as when booking, e.g. quota). “Details” shows who has already joined and offers **Report**. Your own replies are listed under “My replies” with “Withdraw reply”.
- **My request:** shows “2 of 3 found” and who replied when (“Remove” takes a reply out). “Edit” changes the request; once there are replies, format, time and court stay as agreed. “Withdraw” ends it; a booked court stays booked.
- **Book a court:** when a request without a court is full, “Book a court” opens the booking window on the right day with the duration and all players; “For me” reminds you. If no court is free at the start time, the member picks one. Booking follows the normal rules; afterwards the request is done.
- **I'm looking for players too:** members who voluntarily enter their playing level and LK see matching requests first (same or neighbouring level, LK within the range wanted). Others do not see these details; switching off deletes them at once.
- **Push:** “Someone is in” and “Your request is full” go to the creator if the board has enabled these occasions under Member app › Notifications. There is no push for new requests.

**On the tablet** (tab “Courts”) you see the same plan. Tap a free slot, search for your own name (from two letters on), enter your **PIN** and book; anyone without a PIN sets one right there. On a court with a gate, the tablet shows a window with the court code after booking until “Done” is tapped – without input it closes by itself after about a minute, so the next person at the tablet does not see the code. Tapping a booking and “Cancel” also needs the PIN – for the person who booked and for every playing partner entered. For recurring bookings the tablet asks: “Only today”, “Today and all following” or “Entire series”. As in the app, further days up to the booking window can be chosen above the plan; after 2 minutes without input the tablet jumps back to today.

## Permissions {#rechte}

| Permission | What it allows |
|---|---|
| Courts: view occupancy | View occupancy, bookings, fees, statistics and partner search |
| Courts: book for members, single bookings with booking type | Enter and edit bookings and blocks, book and cancel fees by hand |
| Courts: cancel other people's bookings | Cancel bookings and blocks; hide partner search requests and block members from it |
| Courts: create and end recurring bookings & blocks | Recurring bookings, blocks and schedule import; repeating in the booking window |
| Courts: courts, booking types & settings | Tabs “Courts & equipment” and “Settings” with booking types and special rights, partner search settings; the gates for the court code only together with the “Access” permission |
| Courts: set up guest booking (PayPal), cancel guest bookings, resolve discrepancies | Tab “Guests”: set up, key, PayPal access, courts for guests, view a guest booking with contact details, cancel with refund, resolve discrepancies. Everyone with a Courts permission may view the tab (without contact details). |

Members and coaches book in the app and on the tablet without any admin permission. Someone who may only view the occupancy sees the plan but cannot enter anything.

## Working with other modules {#zusammenspiel}

- **Members:** names, membership, fee types and roles come from there, as do the payment status and collection of fees (Fees & payments › Open items). When duplicate members are merged, bookings, recurring bookings, waiting list and fees move with them. When a member is deleted, the waiting list entries are dropped and their recurring bookings carry on as club bookings; past bookings remain as history. A member's data report includes their bookings, fees, waiting list and special rights. The corresponding record appears under Settings › Privacy.
- **Sales:** fees for coaches, and fees without the Members module, go to the sales account and are settled there.
- **Match play:** the schedule import also passes matches on to Match play (match days, teams).
- **Tournaments:** the module books the courts for matches (club championship) and blocks them on tournament days – with a preview of which bookings are affected. Tournament matches are club bookings without a fee.
- **Access:** doors with a keypad can be chosen per court as gates for the court code. When someone types a code at the gate, Access asks the Courts module whether a booking with this code may open this gate right now, and then opens it as from the app. Without Access there are no codes; without Courts no keypad opens anything.
- **Accounting:** income and PayPal fees of guest bookings appear in the bookkeeping (payment method PayPal, income type “Guest bookings (PayPal)”), refunds as a separate entry.
- **Guest booking (Access):** guest bookings on courts with gates get a court code; it is in the guest’s confirmation email. Guests’ contact details are stored encrypted in the vault; their deletion period is under Settings › Privacy.
- **Faults:** courts and equipment appear there automatically as locations.
- **Setup and overview:** the setup assistant walks you through “Create courts” and “Rules for booking”. The overview shows open fees and today's bookings.
- **Member app:** “For me” shows the member's own next bookings, courts that became free from the waiting list and bookings cancelled by a court block.
