# Irrigation
<!-- kurz: Irrigate courts from a phone, the tablet or the admin area – zones run one after another and everything is logged. -->

## What is the module for? {#wofuer}

With this module you start manual irrigation of your courts without walking to the valve cabinet: in the member app, on the clubhouse tablet, in the admin area or in a separate web app for phones. A court can have several zones. They run one after another so that the water pressure is enough. An emergency stop switches everything off at once, and the history shows who irrigated what and when. The schedules of the controller itself stay with the manufacturer.

The module works on its own. All you need is a controller that Clubwerk can switch: either through Home Assistant (many manufacturers) or, for Hunter Hydrawise, directly with an API key. Without member management you operate irrigation with the club PIN or with a user account.

## Setting up {#einrichten}

1. **Settings › Modules:** switch on “Irrigation”. With “Demo” you can try the module with made-up data first; the demo never switches real valves.
2. **Connect the controller:** add your manufacturer’s integration in Home Assistant (each zone then appears there as a valve or switch). In Clubwerk, open Irrigation › Settings › “Connection” and choose the manufacturer.
3. **Create courts and zones:** tab “Courts & zones”, “+ Court”, assign the zones and enter the run times.
4. **Who may operate it?** Set a club PIN, or limit operation to authorised members or users (tab “Settings”).
5. **Test it:** tab “Operate”, start a court and stop it again straight away. If the valve runs, you are ready.

> The setup assistant (menu item “Setup”) guides you through the steps “Connection” and “Courts and zones”.

## Admin area {#verwaltung}

The “Irrigation” page has four tabs at the top: **Operate**, **Courts & zones**, **History** and **Settings**. Anyone who only has the permission “Operate irrigation” sees just the tab “Operate”.

### Page “Irrigation” {#beregnung}

![The “Irrigation” page with the tab “Operate”.](bild: seite=beregnung; tab=bedienen)

Under the heading there is one sentence about the purpose of the page, and below it the tabs.

### Tab “Operate” {#beregnung-bedienen}

Here you control irrigation, shown in the same way as in the member app and on the tablet.

#### Card “Courts”

Each court is a tile with a name and subtitle (e.g. “Clay”). On the right is the button **▶ Start**. Irrigation starts only with this button, not by tapping the whole tile.

- **While a court is running,** the tile shows the zone name (“North running”) and the countdown. **■ Stop** switches off just this court.
- **While a court is waiting,** it says “Starts in 4:30”. Only one zone runs at a time; other courts queue up and move forward as soon as a court is finished or stopped.
- **Locked courts** show “from 14:30”. This is the lock-out after irrigation (see Settings › “Who may operate it?”).
- While the controller’s own schedule runs, the tile says “Automatic running”. You can stop that run too.
- Below the tiles you see when the next automatic irrigation is, if you chose a sensor for it under Settings › “Web app”.

![Card “Courts”: tiles with a “Start” button and the button “Switch off all zones”.](bild: seite=beregnung; tab=bedienen; ziel=.card)

If there is no connection to the system, a red notice appears at the top (“No connection to the irrigation system”), the tiles are greyed out and nothing can be started. That is how it looks in the pictures of this guide, because the demo is not connected to a real system. The display refreshes by itself, every 5 seconds while anything is running.

#### Switch off all zones

The red button **■ Switch off all zones** below the tiles is the emergency stop. After a confirmation it ends running and scheduled irrigation immediately. It only appears once there are courts, and it is greyed out without a connection to the system. If switching off does not work everywhere, Clubwerk says so explicitly, so nobody assumes the water is off.

### Tab “Courts & zones” {#beregnung-plaetze}

![The tab “Courts & zones” with the button “+ Court” at the top right.](bild: seite=beregnung; tab=plaetze; rahmen=#bAddPl)

At the top, a green banner shows how many switchable zones Clubwerk has found (“Connected – 5 switchable zones found”). A red banner says that the controller is not answering (as in the picture, because the demo has no real system); in that case check Settings › “Connection” first.

#### Card “Courts & zones”

Each court is a box of its own. **+ Court** (top right) creates a new one. For each court there is:

- **Name** (up to 30 characters), e.g. “Court 1”. This is what the tile is called everywhere.
- **Subtitle:** text under the name. If you leave it empty, Clubwerk writes something like “Front first, then back · 2 min each” itself.
- **Arrows ↑ ↓:** order of the courts. It applies on every screen.
- **Zones:** for each zone you choose the **device** (the valve or switch from Home Assistant), a **name** (up to 20 characters, e.g. “Front”) and the **minutes** (a comma is fine, 0.5 to 60). **Remove** takes the zone out, **+ Zone** adds one. Several zones run one after another in the order shown.
- **Delete court:** after a confirmation. It is only gone for good after “Save”.

With the direct Hydrawise connection you enter the **zone number** instead of the device, that is the connection on the controller (1, 2, 3 …).

“Save” at the bottom applies everything. A zone runs for at least 10 seconds and at most 60 minutes.

> Set the zone’s default run time in the manufacturer’s app to at least as long as here. Clubwerk switches off by itself after the set time; the controller is only the safety net behind it.

### Tab “History” {#beregnung-verlauf}

![The tab “History” with the month selection and the button “Excel”.](bild: seite=beregnung; tab=verlauf; rahmen=a.btn)

The history shows, for each month, what was irrigated manually. You choose the **month** at the top left above the table; **Excel** (top right) downloads the month as a spreadsheet. The columns:

| Column | Content |
|---|---|
| Time | date and time |
| Action | Start, Stop, Error or Authorisation |
| Court | which court was affected |
| Minutes | planned run time for a start |
| Who | name of the member or user; “Club PIN” for the club PIN, “without PIN” for “Stop without PIN”, “System” for automatic runs or when the module is switched off |
| Note | e.g. “2 zones one after another” or the controller’s error message |

Errors also appear on the Overview (“new error today”). Once you have looked at the history, this notice disappears until a new error occurs. The history is deleted after the period set under Settings › Privacy (default 12 months).

### Tab “Settings” {#beregnung-einstellungen}

The tab consists of five cards, each with its own “Save”.

#### Connection

Here you choose the **controller manufacturer**: Hunter Hydrawise (via Home Assistant or directly with an API key), Rain Bird, Rachio, OpenSprinkler, Orbit B-hyve, Gardena, Shelly relays on solenoid valves, ESPHome or “Other manufacturer”. The banner at the top shows whether the connection is up.

- **Via Home Assistant:** under the field it says which integration you need to add in Home Assistant. The zones then appear as a choice in “Courts & zones”. If the list is empty, the add-on has no access to Home Assistant; rebuild and restart the add-on.
- **Directly with Hydrawise:** enter the **API key** (from hydrawise.com › Account › Settings). It stays on the server and is never visible in the browser. “Delete key” removes it after a confirmation; afterwards Clubwerk cannot switch anything.
- **Changing manufacturer:** if this changes the type of connection (Home Assistant or direct), Clubwerk asks first, because the courts have to be created again afterwards.

![Card “Connection”: choose the manufacturer and check the connection.](bild: seite=beregnung; tab=einstellungen; ziel=[data-card="anbindung"])

#### Who may operate it?

Here you decide how irrigation is operated.

- **Open with club PIN (separate web app):** everyone in the club Wi-Fi opens the web app and operates it with the shared club PIN.
- **Authorised members only (member app):** only members who are authorised for irrigation under “Member app”, using their own phone. The history shows the name.
- **Locked – only users with a password:** users with the permission “Operate irrigation” can sign in (under Users & permissions, including accounts that may do nothing else).
- **Lock-out after irrigation (minutes, 0 = off):** after a run the same court cannot be started for this long. The tile shows “from 14:30”. This stops a court being watered several times in a row.
- **Red stop button works without a PIN:** stopping then needs no PIN, so nobody has to search in an emergency.
- **Club PIN (4–8 digits):** it says “set” or “not set yet”. To change it, enter the new PIN and save; the old PIN is never shown. It only applies for “Open with club PIN”.

Members with authorisation in the member app operate irrigation there in every mode. After 20 wrong PIN entries, PIN entry is blocked briefly for everyone and you receive a security message.

![Card “Who may operate it?”: operation, lock-out, stop without PIN and club PIN.](bild: seite=beregnung; tab=einstellungen; ziel=[data-card="bedienen"])

#### Web app

The web app is a separate page for phones. Its address is shown in the card (`http://<Home Assistant address>:5000`). Open it in the browser and choose “Add to Home Screen”, and it sits on the phone like an app.

- **Name on the home screen** (up to 20 characters) and **Subtitle** (up to 40 characters) set what the web app is called and what appears in its header.
- **Display “next automatic irrigation” (optional):** only with Home Assistant. You choose a sensor whose value appears below the tiles.

![Card “Web app”: name, subtitle and sensor for the next irrigation.](bild: seite=beregnung; tab=einstellungen; ziel=[data-card="webapp"])

#### Notifications

Only with Home Assistant as the connection. Under **“Notify on fault”** enter the name of the Home Assistant service (`notify.…`, e.g. `mobile_app_handy_platzwart`). It sends a message to the phone when a zone does not start or cannot be switched off. With the direct Hydrawise connection this card only shows a note.

![Card “Notifications”.](bild: seite=beregnung; tab=einstellungen; ziel=[data-card="benachrichtigungen"])

#### Transfer settings

Export the connection, courts with zones, operation and web app as a file and import them into another Clubwerk installation, e.g. after a reinstall. The club PIN and API key are not included.

![Card “Transfer settings”.](bild: seite=beregnung; tab=einstellungen; ziel=#bFunc)

## Tablet and app {#tablet-app}

![The “Irrigation” section in the member app.](bild: app=beregnung)

![The “Irrigation” tab on the tablet.](bild: tablet=Irrigation; hoehe=430)

Irrigation looks the same everywhere: the same tiles with “▶ Start” and “■ Stop” and a status line “Connected to the irrigation system” at the top. The only difference is signing in:

- **Member app:** the “Irrigation” section only appears for members you have authorised under Member app (also “Not a member” accounts, e.g. coaches). The phone is paired, so starting and stopping work without a PIN. In the club Wi-Fi the section is open. Away from the club it is locked (“Club Wi-Fi only”), unless you give a member the exception “also when away”; then the app asks for the PIN when starting. Stopping always works without a PIN. For safety, at most 10 starts per minute are possible.
- **Tablet:** the “Irrigation” tab appears when it is switched on under Settings › Tablet. When starting, the tablet asks for the club PIN every time; it never remembers it. If operation is set to “Authorised members only”, the tablet does not show the tab.
- **Web app (own port):** depending on the operation setting, it unlocks with the club PIN, shows “Member app” (locked) or asks for user name and password. The PIN is only kept in the page’s memory. The web app can only be reached from the club network, never through the tunnel.

## Permissions {#rechte}

| Permission | What it allows |
|---|---|
| Irrigation | Set up courts and zones, change settings, view the history, start and stop courts |
| Operate irrigation | Start and stop courts (tab “Operate” in the admin area and the locked web app), nothing else |

Who may operate irrigation in the member app is not set by a permission but under Member app › Sections.

## Working with other modules {#zusammenspiel}

- **Home Assistant:** the valves come from there. Without Home Assistant only the direct Hydrawise connection works.
- **Member app and member management:** the “Irrigation” section can be authorised per member; the name appears in the history. A member’s data access request includes their irrigation runs.
- **Privacy:** the period for the history also appears under Settings › Privacy and in the record of processing activities.
- **Overview:** shows courts, irrigations started today, what is running now, a missing connection, a missing club PIN and new errors.
- **Backup:** the month’s history is included in the backup as an Excel file.
- **Safe on switch-off:** if you switch the module off or Clubwerk restarts (update), running zones are switched off at once instead of staying open.
