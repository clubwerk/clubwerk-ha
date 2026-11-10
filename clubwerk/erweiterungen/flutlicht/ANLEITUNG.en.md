# Floodlights
<!-- kurz: Switch the court lights automatically for bookings or by phone – they always switch themselves off again. -->

## What is this module for? {#wofuer}

Clubwerk switches the floodlights of your courts. If a court is booked for a time after dark, the light comes on shortly before and goes off again after play. Authorised members switch it on with the member app on the clubhouse Wi-Fi, on the club tablet with their name and PIN, and the admin area can switch it at any time. The light always switches itself off again, at the latest at lights-out. If you want, Clubwerk charges a light fee per started quarter of an hour.

The module also works on its own. Without the “Courts” module there is no automatic switching, only switching by hand. Without the member management, names are just first and last name.

### What do I need? {#was-brauche-ich}

- **Home Assistant** with **one switching actuator per court**, shown there as a switch (`switch.*`) or light (`light.*`). The manufacturer does not matter (for example Shelly, KNX, Homematic, Zigbee relays).
- The actuator switches a **contactor** that powers the floodlights. Floodlights draw a lot of current; a small relay alone is not enough.
- **Installation and wiring only by a qualified electrician.** The mast and the distribution board carry mains voltage.
- Recommendation: add a small automation in Home Assistant as well, “light on for more than 4 hours → off”. It keeps the light off in case Clubwerk is not running at all.

## Setting up {#einrichten}

1. **Set up the switches in Home Assistant:** Each court has a switch that works in Home Assistant (Settings › Devices & services).
2. **Settings › Modules:** Switch on “Floodlights”. With “Demo” you can try the module first with made-up data.
3. **Assign permissions:** Under Settings › Users & permissions, give the “Floodlights” permission to whoever should set everything up. Anyone who should only switch (for example the groundsman) gets “Operate floodlights”.
4. **Add the lights:** “Lights” tab › “+ Light”. For each court choose a name, switch and court. Then switch it on and off once under “Operate”.
5. **Set the times:** “Times” tab: location for sunset and lights-out.
6. **Authorise members:** Under Member app, authorise the “Lights” section for the members who may switch. On the tablet, “Lights” appears once you switch it on under Settings › Tablet.

## Admin area {#verwaltung}

The “Floodlights” menu has five tabs: **Operate**, **Lights**, **Times**, **History** and **Settings**. Anyone with only the “Operate floodlights” permission sees just “Operate”.

How switching works: a light stays on as long as there is a reason for it, for example a booking or a member who switched it on. Every reason has a fixed end that Clubwerk stores. So the light goes off on time even after a restart or an update.

### “Operate” page {#flutlicht}

![The “Operate” page: the “Today” card and the lights below it.](bild: seite=flutlicht)

#### Today

![“Today” card: from when it is dark, lights-out, automatic switching and the light fee.](bild: seite=flutlicht; ziel=.card:has(.vh-kv))

The card shows from when light is possible today (**Dark from**), when **lights-out** starts, whether **automatic switching** from court bookings is on, and the **light fee**. If members, the tablet and automatic switching cannot switch right now (lights-out, blocked day, outside the season), the reason is shown below.

#### Lights

Each light is a tile. When it is on, the tile is highlighted and shows until when (“On until 20:30 · 42 min left”) and why (“Booking Becker, Anna”, “Club booking”, “App: …”). When it is off, it shows when automatic switching will turn it on next.

- **Turn on:** opens a window where you choose how long (30 minutes to 8 hours). From the admin area this also works before dark, after lights-out and without a light fee.
- **+30 min:** extends the light (you set the number of minutes in the settings).
- **Switch off:** switches off immediately, even light for a booking.

![“Turn on” window: how long the light should stay on.](bild: seite=flutlicht; klick=[data-a="on"]; ziel=dialog)

If a switch cannot be reached in Home Assistant, the tile is grey and cannot be turned on.

#### All off

“All off” (with a confirmation) switches every light off immediately and ends all running times. Automatic switching does not turn the light on again for the same bookings, only for the next booking.

### “Lights” tab {#flutlicht-anlagen}

![The “Lights” tab: all lights with switch, court, lead time and run-on.](bild: seite=flutlicht-anlagen)

The list shows each light with **name**, **switch in Home Assistant**, **court**, **lead time** and **run-on**. The order also applies in the app and on the tablet; move a light with ↑ and ↓. If a switch is missing in Home Assistant, “missing” is shown after it.

#### + Light / Edit

![“Edit light” window: name, switch, court, lead time and run-on.](bild: seite=flutlicht-anlagen; klick=[data-ed="0"]; ziel=dialog)

- **Name:** what the light is called everywhere (up to 30 characters), usually the court’s name.
- **Switch in Home Assistant:** a `switch.*` or `light.*`. A switch belongs to exactly one light and to no other module.
- **Court (for automatic switching):** the court from the “Courts” module. Each court has exactly one light; courts already taken are disabled in the list. “No court” means: by hand only (for example a training pitch without bookings).
- **Lead time:** this many minutes before a booking the light comes on (0 to 30). Some floodlights need a few minutes to reach full brightness.
- **Run-on:** how long it stays on after the booking ends (0 to 30).

When editing, **Delete light …** is set apart at the bottom (with a confirmation). The history is kept.

> If you change the switches, the board is notified with “before” and “now” as a safety measure.

### “Times” tab {#flutlicht-zeiten}

#### Darkness

![“Darkness” card: sunset from the location, offset and preview.](bild: seite=flutlicht-zeiten; ziel=.card:has(#flSrc))

Clubwerk calculates sunset itself from the **latitude and longitude** of your courts (no internet needed). Alternatively it takes it from Home Assistant (`sun.sun`). The **offset** sets from when light is possible, for example “-30” = half an hour before sunset. Below the fields you see what that means today and in four weeks. Before that, neither automatic switching nor members can switch.

#### Lights-out

![“Lights-out” card: time for each day of the week.](bild: seite=flutlicht-zeiten; ziel=.card:has(#flQ1))

For each day of the week the time at which everything switched on by members, the tablet and automatic switching goes off (between 17:00 and 24:00; default 22:00). It then stays off until 6 in the morning. If a light is switched on in Home Assistant during this time, Clubwerk switches it off again. Only the admin area may switch on after lights-out, for a fixed time.

#### Season

If “Light only during the season” is ticked, members, the tablet and automatic switching only work between the two days (for example 01.04. to 31.10.; across the turn of the year is possible too). Outside it, only the admin area can switch.

#### Blocked periods

![“Blocked periods” card: days on which the light stays off.](bild: seite=flutlicht-zeiten; ziel=#flBBox)

On blocked days neither members nor automatic switching can switch, for example while the masts are serviced. “+ Blocked period” is at the top right; in the window enter **From**, **To** and optionally a **reason**. When editing, **Lift blocked period …** removes the block again.

### “History” tab {#flutlicht-verlauf}

![The “History” tab: switching times of the month, operating hours and events.](bild: seite=flutlicht-verlauf; zeitraum=#flMonth; voll=#flLog table tr:nth-child(5); hoehe=520)

#### Switching times

At the top choose the **month**. Columns: **light**, **time** (from–to; “on” while it is running), **duration**, **trigger** (automatic, app, tablet, admin area or “outside Clubwerk”, with name and the reason it ended) and **light fee** with its status (open, paid, cancelled). “Excel” at the top right downloads the month as a spreadsheet.

**Cancel** takes back a light fee (with a confirmation), for example after a mistake. If the item is already part of a direct debit, Clubwerk refuses and says what to do.

#### Operating hours

How long each light was on during the year, for example for servicing the floodlights. If two reasons overlap (booking and extension), the time counts only once.

#### Events

Faults (“Home Assistant is not responding”, with “Resolved” once it works again), switching off at lights-out, “All off” and rejected attempts.

### “Settings” tab {#flutlicht-einstellungen}

#### Connection

“Test connection” checks whether Home Assistant responds, how many switches there are and whether each light can be reached.

#### Who may switch?

![“Who may switch?” card: automatic, app, tablet, maximum duration and extension.](bild: seite=flutlicht-einstellungen; ziel=.card:has(#flWA))

- **Automatic:** light booked courts after dark (needs the “Courts” module).
- **Members in the app:** authorised members only, only on the clubhouse Wi-Fi. The number in brackets shows how many are authorised.
- **On the tablet:** with name and app PIN, authorised members only.
- **Maximum in one go:** the longest time members can choose at once (15 to 240 minutes, default 90).
- **Extend by:** minutes for the “+30 min” button (5 to 120).

#### Light fee

![“Light fee” card: amount per started quarter of an hour and from what time.](bild: seite=flutlicht-einstellungen; ziel=.card:has(#flFee))

Off by default. When switched on, Clubwerk charges the amount for every **started quarter of an hour** from the set **time**. It is booked like the court fee: as an open item in the member management, or for coaches and without member management to the sales account. This is how it is calculated:

| Case | Who pays | What counts |
|---|---|---|
| Automatic, single booking | whoever booked | only the booked time; lead time and run-on are free |
| Booking cancelled while the light is on | whoever booked | only until the cancellation |
| App or tablet | whoever switched it on | until switched off (at most until the planned end) |
| Extending someone else’s light | whoever extends | only the extra time |
| Admin area, series, team, club and tournament bookings | nobody | – |

Example: 18:55 to 20:30 with €0.50 from 18:00 is 7 started quarters of an hour, so €3.50. The amount set when the light was switched on applies.

#### Notifications

If a light cannot be switched, Clubwerk can notify a phone: the phone’s name in Home Assistant (the “notify” service). Empty = no message. Clubwerk keeps trying in any case.

#### Transfer settings

Export lights, times and settings as a file and import them into another installation. The link to courts, the history and light fees are not included.

## Tablet and app {#tablet-app}

![The “Lights” section in the member app.](bild: app=flutlicht)

**In the app** (“Lights” section) authorised members see all lights. At the top it shows whether the phone is on the club Wi-Fi and from when light is possible. “Turn on” opens a window with 30, 60 or 90 minutes, the time at which the light goes off and the expected light fee. A member can only switch off what they switched on themselves (or their own booking); they can extend someone else’s light. Other people’s names never appear, only “for a booking”. If the light fee is on, the “Light fee” card shows the member’s own latest items.

Switching only works on the clubhouse Wi-Fi, never over the internet, not even with the “also when away” exception.

![The “Lights” page on the tablet.](bild: tablet=Lights; hoehe=560)

**On the tablet** there is a “Lights” tab once you switch it on under Settings › Tablet. After tapping, choose the duration, type the first letters of your name and enter the app PIN. Only authorised members with a paired phone appear. The protection against wrong PINs is the same as for the doors: after 10 wrong PINs within 24 hours, switching lights on the tablet turns itself off and the board receives a warning.

## Permissions {#rechte}

| Permission | What it allows |
|---|---|
| Floodlights | Everything in the “Floodlights” menu: lights, times, history, cancelling light fees and settings; also operating |
| Operate floodlights | Only the “Operate” page: switch lights on and off, extend, “All off”. Nothing to set up |

## Working with other modules {#zusammenspiel}

- **Courts:** provides the courts and the bookings for automatic switching. Without the module there is only switching by hand.
- **Members:** the light fee is booked as an open item (type “other”) and is collected with the next direct debit. A member’s data request lists their switching times.
- **Sales:** without member management and for coaches, the light fee goes to the sales account and is settled with the drinks.
- **Member app and tablet:** authorisation, pairing and PIN run through the member app.
- **Overview:** shows the number of lights and “Lights on” and warns about faults or a missing location.
- **Setup:** the setup assistant guides you through “Add lights” and “Darkness and lights-out”.
- **Data protection:** under Settings › Data protection you set how long names stay in the history (3 to 60 months, default 24). After that Clubwerk removes the names; durations and operating hours remain. Entries with a light fee are accounting records and keep the name for 10 years (retention duty).
- **Other modules using Home Assistant:** a switch can only be used in one module.
