# Clubwerk Basics
<!-- kurz: Admin area, setup, accounts, member app, permissions, backup, messages and settings – everything that applies to the whole club. -->

## What is this module for? {#wofuer}

This is the core of Clubwerk. It is part of every installation and contains everything that does not belong to a single module: the overview, the setup assistant, accounts and PINs, the management of the member app, users and permissions, backup, the log, messages to members, the bank statement and the settings for the whole club.

You switch modules (Sales, Courts, Defects …) on under Settings › Modules. The core also works with no modules at all. You reach it in the admin area through “Overview”, the “Club” area (Users & permissions, System, Settings) and the “Members” area (Messages, Member app).

## Setting up {#einrichten}

1. **First start:** Open Clubwerk in the Home Assistant sidebar. You see “Welcome to Clubwerk”. Choose the language and tap “Start setup”. (With “Try the demo” you can get to know Clubwerk first, using made-up data.)
2. **Create the admin account:** name, username and password (at least 8 characters). This account has all permissions.
3. **Work through the assistant:** It guides you through club, tablet, modules, security, mailbox and backups (see “Setup” below). Every item can be skipped and done later.
4. **Create more users:** Under Users & permissions everyone gets their own account with the permissions they need.

> Two things should be done straight away: set a **backup password** (Backup) and print the **emergency sheet**. Without them a backup is worthless.

## Admin area {#verwaltung}

The menu is on the left, sorted into areas: **Catering**, **Sport**, **Facilities**, **Members**, **Finance** and **Club**. A click on an area expands or collapses it. The area of the page you are on is always open, and each device remembers which areas you leave open. A dot on a collapsed area shows that something needs doing in it. If you may only see a few pages (up to 9), you see everything without expanding, under the area headings. With the keyboard, the up and down arrows move between rows, the right arrow expands an area and the left arrow collapses it. At the top of the menu, **Search** (shortcut Ctrl K or ⌘K) finds pages, settings, actions and people. Your name is at the bottom: a click opens “My account”; next to it the tablet icon opens the tablet page in a new tab and the arrow logs you out. Via **Admin** in the tablet header, Clubwerk logs you out after one minute without input; a login directly in the admin area (for example in the Home Assistant sidebar) is not affected, even in the same browser. The **“?”** at the top right opens the guide for the area you are in, as a PDF.

### Page “Overview” {#uebersicht}

![The overview: greeting, setup progress, “To do” and the grid of modules.](bild: seite=uebersicht)

The overview is your home page. It shows what matters today.

#### Setup … % complete

A single line with a bar. “All items” opens the “Setup” page, “Continue setup” jumps to the next open item. It disappears once everything is done.

#### To do

![The “To do” card with coloured notes. Red notes come first.](bild: seite=uebersicht; ziel=.todo)

Notes from the core and from all modules appear here: open security warnings, missing backup password, encryption switched off, no club network, new entries from the tablet to confirm, low stock and much more. Red is urgent, yellow is a note. Six notes are visible, “Show all” opens the rest. The link at the end of a line takes you straight to where you fix it. You only see notes you are allowed to deal with.

#### Grid of modules

![The grid of modules: name, state and the most important figure.](bild: seite=uebersicht; ziel=.mods2)

Every module that is switched on has a tile with its state (Running, Note, Fault) and its most important figure. A click opens the module. Below, if there is anything, you find “Low stock” and “Latest deliveries” from Sales.

> On a phone, the button at the top right opens the menu. It shows the area you are in (for example “Finance”).

### Tab “Setup” (page “System”) {#einrichtung}

The **System** page in the “Club” area has three tabs: Backup, Log and Setup.

![The “Setup” tab: open, done and hidden items.](bild: seite=einrichtung; ziel=.card:has(.wizbar))

The checklist for everything that belongs to setting up. At the top it says “Setup … % complete”. Items are sorted into three lists: **Open**, **Done** and **Hidden**. They cover the general steps (language, admin account, club, “How do you use Clubwerk?”, choose modules, security, mailbox, member app, club network, backups) and the steps of your modules (for example “Items and prices” in Sales or “Create courts” in Courts). Each module reports its own steps.

- **Set up** opens the assistant at this item.
- **View** on a finished item shows the setting again.
- **Hide** removes an item from the checklist if you do not need it. “Show again” brings it back.
- **Go through the assistant again** starts from the beginning.

![The assistant at one step: progress at the top, the matching setting below, “Later” and “Next” at the bottom.](bild: seite=einrichtung; klick=[data-wgo="sicherheit"])

In the assistant you see “Step x of y” with the progress at the top and a short explanation. Below it is exactly the card of that setting; everything else is hidden. **Next** goes to the next step, **Later** leaves the item open, **Back** goes one step back, **Finish setup** closes the assistant. The steps “Choose modules” and “Done” have their own view.

> In a demo installation a bar at the top says “Demo – all data is made up”. “End demo and set up …” deletes all sample data completely (confirm with your password). Real setup then begins.

**Without a tablet:** In the step “How do you use Clubwerk?” you choose “With a tablet in the clubhouse” or “Without a tablet”. With a tablet you set the password straight away that each tablet is authorised with once.

### Page “Members & accounts” {#konten}

![The four figures at the top: active members, teams, PINs, amounts due.](bild: seite=konten; ziel=.kpis)

![Search and filters above the list.](bild: seite=konten; ziel=.filterbar)

Here you manage the **accounts for sales on the tablet**: who owes how much, who has a PIN, teams and special accounts. With the member administration module the page is called “Accounts & PINs” and sits in the “Sales” menu. Members are then created there; here you only create “Not a member” accounts (for example coaches) and teams. Without the member administration there are only first and last names.

#### At the top: buttons and figures

- **+ New member** (or “+ New account”) creates an entry: name, type and, for teams, the PIN.
- **Import …** reads an Excel file with first name and last name (optionally type and PIN). You can download a template; beforehand you see how many entries are new.
- **Paste list …** creates many names at once (one name per line).
- Four figures: active members, teams & groups, PIN-protected, due on accounts.

![Creating a new account: name and type.](bild: seite=konten; klick=#mNew; ziel=dialog)

#### Newly entered on the tablet

If someone enters themselves on the tablet with “I'm new”, they appear in a yellow card. You can adjust the name and **Confirm**, merge into an existing account with **Is already a member …** (their bookings move along) or, if they have booked nothing, **Delete**.

#### Not here this season

A card with members who have booked nothing since the start of the season. **Remove** deletes entries without bookings; anyone who has booked before is only **Hidden** (old statements stay). Anyone with an amount due must be settled first.

#### List and account

The list has the columns **Name** (as “Last name, first name”), **Type**, **PIN** (set, none, locked, for teams “from the board”), **Last here** and **Due**. Above it you search and filter: All, Members, Not a member, Teams, Special accounts, With amount due, Hidden.

![The account next to the list: amount due, PIN and actions.](bild: seite=konten; klick=tr[data-sel]; ziel=#mDetail)

A click on a name shows the account on the right (in a window on a phone):
- **Bookings** opens this person's bookings.
- **Edit** changes name, type and PIN (for teams only the board sets the PIN). “Show on the tablet” hides an account. The window also holds the member app authorisations and “Delete”.
- **Reset PIN:** next time the person sets a new PIN on the tablet. Until then booking and cancelling courts on the tablet is blocked.

Special accounts are **Club (free of charge)** and **Guest (cash)**.

### Page “Member app” {#app}

This is where you set up the app for members. A member gets **one invitation** (QR code, email or letter), uses **one PIN** and sees what you have authorised. The PIN also works on the tablet. The page has four tabs, shown according to your permissions.

### Tab “Members” {#app-mitglieder}

![Tab “Members”: authorise a member.](bild: seite=app; klick=[data-sec="mitglieder"]; ziel=.card:has(#apGo))

#### Authorise a member

Choose a member, tick the sections you want and tap **Activate & invite …**. A choice opens for how the invitation reaches the member.

![The invitation: QR code on screen, by email or as a letter.](bild: seite=app; klick=[data-sec="mitglieder"]; klick2=[data-aq]; ziel=#askBox)

- **QR code here on screen:** The member scans it with the phone camera, ideally right here. It works once and only for a short time (adjustable). Then the member sets their app PIN. Do not photograph the code: whoever scans it first gets access.
- **Send by email:** a personal link, valid for a few days. Needs a mailbox and the address in the member administration. Right after the greeting the email says what to do (“Open this email on your phone and tap the button”), has a large full-width button “Activate app now”, three numbered steps and, below, the address as text in case the button does not work.
- **Print invitation letter:** QR code with instructions on paper.
- **Approve areas in the club Wi-Fi now:** only appears if a phone was paired from outside without an SMS code.

#### Authorised members

![The “Enabled members” list: per member the phone state, access in one sentence and three buttons.](bild: seite=app; klick=[data-sec="mitglieder"]; ziel=.card:has(#apTbl))

The list has one row per member: **Phone** (one pill: phone authorised, QR code open, invitation expired, locked, old address or “Open once in the club Wi-Fi first”), **Access** in one sentence (“all sections”, “all except Irrigation”, “3 sections” or “none”) and **Last used**. The filters “with phone”, “without phone”, “invited”, “open in Wi-Fi first” and “old address” help with tidying up. At the end of a row are three buttons: **Edit access**, the envelope button (invites again) and the bin (removes: **Remove phone only** – with a new QR code the member is back – or **Remove from the app entirely**). **Send invitations …** invites many people at once by email or as letters. On a phone, tap the row to open the access.

![The “Edit access” window: a tick per section, “away” as its own pill.](bild: seite=app; klick=[data-sec="mitglieder"]; klick2=[data-ae]; ziel=#dialog)

The **Edit access** window has a tick per section; changes apply immediately. Next to it, where available, are the time profile (for doors) and small switches. **away** lets a member use this section outside the club Wi-Fi as well (an exception, e.g. for the groundsman or phones with iCloud Private Relay).

**“Open once in the club Wi-Fi first” – what does it mean?** If a member authorised their phone **while away and without an SMS code**, the sensitive sections (e.g. doors, irrigation, lighting) stay locked for security until the app is opened **once in the clubhouse on the Wi-Fi**; then they unlock themselves. The member sees a note in the app at these sections saying what to do. If you are sure the phone belongs to the member, authorise the sections yourself: **Invite …** › **Approve doors and irrigation now**. The same explanation stands above the list as long as such a phone exists.

> A new QR code, or authorising a new section, can sign the old phone out for security reasons. Simply invite again.

#### Give a section to several members

![The “Give a section to several members” window: choose the section and “Who?”.](bild: seite=app; klick=[data-sec="mitglieder"]; klick2=#apBulkAcc; ziel=#dialog)

With **Give section …** above the list you authorise a section (e.g. doors, irrigation, lighting) for many members at once – instead of ticking it for each one. Choose the **Section** and **Who?**: all members in the app, a membership type (e.g. active) or a department (both only with the member management) or your **own selection** with ticks and search. “Non-member” accounts (e.g. coaches) are only added through your own selection and only for sections that exist for them.

![The preview: who gets the section, who already has it and for whom it is not possible.](bild: seite=app; klick=[data-sec="mitglieder"]; klick2=#apBulkAcc; klick3=#bfPrev; ziel=#dialog)

**Preview** shows how many get the section, how many already have it and for whom it is not possible – each with names to expand. Nothing changes until afterwards. It is not possible for locked authorisations (they stay locked), for expired ones (extend them individually) and for phones invited by someone without the right for this section (authorise individually; the phone then has to be invited again). Members without a phone still get the section – it applies as soon as they pair the app.

For sections that switch something at the club (**doors, irrigation, lighting**) you confirm by typing the word **FREIGEBEN** and your own password; for the other sections the button is enough. Giving doors to many members at once also sends a security warning to the board. Giving a section to many members does not lift “Open once in the club Wi-Fi first”: phones paired while away without an SMS code still open doors, irrigation and lighting only after their first visit to the club Wi-Fi. Only someone with the full right for the section (for doors “Access”) may do this, not a right limited to their own department.

Afterwards **Last bulk authorisation** with **Undo …** appears above the list: it takes the section away again from exactly the members of this last bulk authorisation. Anyone you have changed individually since then stays as they are.

When a new module with its own section is switched on and nobody has it yet, the **Overview** asks “New section …: who should get it?” and **Authorise …** opens this window straight away. If nobody should get it for now, **Nobody for now – hide notice** in the window hides the notice.

### Tab “Sections” {#app-bereiche}

![Tab “Sections”: which sections the app shows, for whom and in what order.](bild: seite=app; klick=[data-sec="bereiche"])

One table for all sections of the app, one “Save” for everything:
- **Switch:** Off = the section disappears for everyone, authorisations stay.
- **For whom:** “all members” or “selected only” with a count.
- **On the go:** Without the tick the section only works in the club Wi-Fi (only with the “Settings” permission).
- **When unlocking:** “preselect” ticks the section for new members automatically.
- **Start** and **↑ ↓:** start section and order. By default the app opens “For me”.

“For me” is always first. It is the start page of the app with the cards “New for you”, “Coming up”, “To do” and “My account”. Open replies to dates and match days appear only as a note (“Dates: n replies open”, “Match days: n replies open”), with no buttons and no time limit. If a member has a bar tab, a tick at the bottom also shows it under “For me”. If the board has released push occasions and the phone has not switched notifications on yet, the card **“Turn on notifications”** sits at the very top, with “Turn on” and “Later” (hides it for 14 days). The sentence on the card names only what the board has actually released and what the club has, for example “So that you don't miss court bookings, match days, duties and messages from the club.” (“… and more” if there are more than four areas). Only the card that is needed next is shown, matching the phone: on an **iPhone** first the steps “Share icon → Add to Home Screen → open from there” (without naming a fixed position, since the bar sits at the top, bottom or in the “…” menu depending on the setting; iOS 16.4 or newer, earlier versions have no push); if the page runs inside another program (Gmail, WhatsApp, Instagram …), first “Open in Safari” with “Copy address”. On **Android** (Chrome, Edge, Samsung Internet) the card **“Install app”** comes first: one tap opens the phone's install dialog, after which the app starts straight from the home screen and stays paired; “Later” hides it for 14 days, where the browser offers no install button (e.g. Firefox) the browser's own steps are shown instead (open the menu › “Install app” or “Add to Home screen”; in Samsung Internet “Add page to › Home screen”; in Firefox “Install”) – never “Share”, which exists only on the iPhone. If the page runs inside Gmail or WhatsApp, “Open in browser” comes first. The card stays until the app is installed or “Later” is tapped, even if notifications already work. It never appears in the installed app. If the browser notices that the app is already installed (Android shares its storage with the app), only the note “You already have the app – open it from your home screen” is shown. On the iPhone Safari cannot know this: there (and with the instructions that have no install button) “I have already installed it” hides the card for good. Push works without a home-screen icon, so “Turn on” follows; in an embedded browser first “Open in browser”. If push is blocked on the phone, the card says where to allow it; a device that cannot do push at all (desktop, Huawei without Google services) gets no card. The card disappears once notifications are on.

**Installing the app – the right card for each device:** “For me” shows only the card that is needed next, never a wrong instruction (the browser is recognised by features, not just by name). It never appears in the installed app.

| Device | Card |
|---|---|
| Android (Chrome, Edge, Samsung Internet, Opera, Xiaomi, Huawei …) | **“Install app”** button; if the browser offers none, the browser's own steps (menu › “Install app” or “Add to Home screen”; Samsung: “Add page to › Home screen”; Firefox: “Install”; unknown browsers: general instructions). Never “Share”. |
| Android in Gmail/WhatsApp etc. | **“Open in browser”** first |
| iPhone and iPad (also Chrome, Edge, Firefox) | Share icon › “Add to Home Screen” (iPadOS reports itself as a Mac and is recognised by touch); before iOS 16.4 in Chrome/Firefox/Edge “Open in Safari” first |
| iPhone/iPad in Gmail, WhatsApp, Instagram … | **“Open in Safari”** first |
| Computer with Chrome or Edge | **“Install app”** button; otherwise the install icon in the address bar or menu › “Install page as app” |
| Safari on a Mac (Safari 17 or newer) | Share icon or “File” › “Add to Dock” |
| Firefox on a computer | no card (Firefox does not install there); notifications work without installing |

“Later” hides the card for 14 days; “I have already installed it” hides it for good (needed where the browser cannot tell by itself, such as Safari on the iPhone). If the browser notices that the app is already there, only the note “You already have the app” is shown.

**Subscribe to calendar:** Under “More” › “My account” every member creates a personal link for their phone’s calendar. It contains their duties, accepted dates, court bookings and matches of their own teams – only from areas they have in the app, without other people’s names. The calendar fetches them regularly by itself. For this to work away from the club, the app needs a public address (“Settings” tab, “Reachable on the go”). “New link” makes the old one invalid, “End subscription” deletes it. If the phone is removed, the link no longer works.

### Tab “Notifications” {#app-push}

![Tab “Notifications”: occasions of one module.](bild: seite=app; klick=[data-sec="push"]; ziel=#pushCard > div:nth-of-type(2))

![Test message to a member.](bild: seite=app; klick=[data-sec="push"]; ziel=.row:has(#pshWho))

Push messages are short notes on the phone (on iPhone only in the home-screen app from iOS 16.4). At the top it shows how many phones are registered. For each module you tick the **occasions** for which a note is sent (for example new message, reminder of a date, new defect report); some have a lead time. Each member only switches push on or off per phone and does not choose individual occasions: what arrives is decided by you alone. Occasions members switched off earlier no longer count. At the bottom **Test message to** sends a note to a member. “Recently sent” shows the latest notes and whether they arrived. Only a title and one sentence are sent, never anything that needs a PIN.

### Tab “Settings” {#app-einstellungen}

This is where the cards for the address and security of the app are.

#### Address & appearance

![Card “Address & appearance”: address in the club Wi-Fi, name on the home screen and access from outside.](bild: seite=app; klick=[data-sec="einstellungen"]; ziel=#apSet)

- **Address in the club Wi-Fi:** phones reach the app at this address. It ends up in the QR code. Empty = the address at which you currently have the admin area open. If an https address has no port (for example `:5001`), the notice “Port missing” appears with a **Use this** button. Addresses with “.local” do not open on some phones; better without “.local” or with an IP address.
- **Name on the home screen:** at most 20 characters.
- **Public address** and **Reachable on the go:** for access from outside via a Cloudflare Tunnel. Only the member app becomes reachable; admin area, tablet and irrigation stay in the club Wi-Fi. The steps are on the card in a collapsible section. **Check connection** tests the route, **Test ↗** opens the app.

If a tunnel is on, the card **Tunnel source** appears: you decide from which address in the Home Assistant network the tunnel may come. This stops another add-on from posing as the tunnel (recommended).

#### Security

![Card “Security”: validity of invitations.](bild: seite=app; klick=[data-sec="einstellungen"]; ziel=#apSec)

How long a QR code (1 hour, 1 day or 7 days) and an email/letter (2, 7 or 14 days) are valid and whether the QR code is also offered as a link to pass on (less secure). After 5 wrong PINs the phone is locked for 5 minutes, from the 10th wrong attempt for 30 minutes, then completely: only a new QR code helps. Who is told about it is set under Settings › Security.

#### SMS confirmation

A second factor for invitations from outside: an LTE USB stick with a SIM card on the Home Assistant computer sends a code by SMS to the mobile number in the member administration. **Search ports**, choose the port, **Save**, switch on **SMS confirmation**, check with **Send test SMS**. Without SMS, doors and irrigation only unlock in the club Wi-Fi when pairing from outside.

### Page “Messages” {#email}

Here you write messages to members, groups and addresses. Three **routes** are available, also combined: **Email**, **In the member app** and **Push notification on the phone**. For emails you need a mailbox (Settings › Mailbox); otherwise only messages in the app and drafts work. Without the member administration these are just the addresses you type in.

### Tab “New message” {#email-neu}

![A new message: sender, recipients, route, subject, text and attachments.](bild: seite=email; tab=neu)

From top to bottom:
- **From:** The sender is always the club mailbox, so mails do not end up in spam. Recipients see your name. “change” opens “My account” (reply address and signature).
- **To:** groups (for example departments), single members, distribution lists and free addresses. Suggestions appear as you type. Separate several addresses with a comma. Red recipients have no address.
- **Route:** Email, In the member app, Push notification. Members without an email address get nothing by email; choose “In the member app” for them.
- **Without own address to the payer:** children without an address reach their parents this way.
- **Copy to me.**
- **Visible in the app:** how long the message stays in the app (default, 1 to 24 months).
- **Pin to the top:** stays at the top of the app until you unpin it.
- **Subject** and **text** with a toolbar: bold, italic, underline, headings, lists, quote, divider line, link. **Placeholder …** inserts, for example, the salutation or first name, replaced for each recipient. **Template …** inserts a saved template.
- **＋ Attach file** or drag files in: up to 10 MB per file, 20 MB in total.
- **＋ Attach poll** (only with “In the member app”): question, 2 to 10 answers, **Result for members** (after their own vote, only after the end, or never), **End** (empty = until you end it), **multiple answers allowed** and **anonymous**. Members vote in the app; each member has one vote and can change it until the end. Anonymous means nobody in Clubwerk can see who chose what – not even the admin area. It does not replace a secret ballot under your statutes.
- At the bottom: **Save as template**, **Discard**, **Preview** (“This is how it looks for …”) and **Sending …**. Before sending Clubwerk asks, showing the number of recipients.

The message is saved automatically as a draft while you write.

> The push occasion “Messages from the club” must be released under Member app › Notifications, otherwise only the message in the app arrives.

### Tab “Drafts” {#email-entwuerfe}

![Tab “Drafts”.](bild: seite=email; tab=entwuerfe)

Everything you have started. A click on a draft opens it to continue writing, **Discard** deletes it.

### Tab “Sent” {#email-gesendet}

![Tab “Sent”: subject, sender, time, number of recipients and route.](bild: seite=email; tab=gesendet)

Every sent message with subject, sender, time, number of recipients and route. At the bottom you set how long messages stay in the app by default (1 to 24 months).

![The delivery of a message: who was reached.](bild: seite=email; tab=gesendet; klick=.ml-row)

A click opens the message with text, attachments and the **delivery**: how many received it by email, in the app, by push, who was not reached and why (no address, invalid, failed). **Resend failed** tries again. **Reuse** opens a copy as a new draft, **Remove from the app** makes it disappear for members at once (emails stay), **Delete** removes it with its list.

![A sent poll: result, turnout and who chose what.](bild: seite=email; tab=gesendet; klick=.ml-row:has-text("Weihnachtsfeier"); ziel=.ml-res)

If the message has a **poll**, the result is shown below it: votes per answer, how many of how many have voted and – if it is not anonymous – who chose what (last name, first name). **End poll** ends it straight away. Members see the open poll under “For me” in “To do” until they have voted. **Reuse** takes the poll without votes into a new draft.

### Tab “Distribution lists” {#email-verteiler}

![New distribution list: a saved list of recipients.](bild: seite=email; tab=verteiler; klick=button.btn.primary; ziel=dialog)

Saved recipient lists such as “Board”, “Coaches” or “Sponsors”. Groups in them stay up to date: anyone joining a department is automatically included. Edit and delete are in the list.

### Tab “Templates” {#email-vorlagen}

![Tab “Templates”: recurring texts.](bild: seite=email; tab=vorlagen)

Recurring messages such as the invitation to the general meeting. **Use** opens one as a new message, **Edit** changes name, subject and text, **＋ New template** creates one. Placeholders such as `{briefanrede}` are replaced for each recipient.

### Page “Bank statement” {#kontoauszug}

![The “Bank statement” page: drop a file, filter and the list of transactions.](bild: seite=kontoauszug; klick=[data-f="nicht"])

Here you read in the statement from online banking, and Clubwerk matches **incoming payments and returned debits** to the open fees and invoices. The page is under “Fees & payments” (without the member administration, under Accounting). There is no connection to the bank, only file upload. The file itself is never stored.

- **Drop a file:** CAMT file (XML or ZIP), Sparkasse “CSV-CAMT” or a CSV export, several files at once, up to 5 MB per file. Clubwerk recognises transactions already read in. Debits are skipped.
- **Unknown CSV:** “Assign columns” opens: choose the club account and say which column holds date, amount, name, IBAN, purpose and debit/credit. Next time Clubwerk remembers the assignment.
- **Last read in:** shows the date up to which the statement reaches.

#### Filter and list

Three filters: **To check** (Clubwerk has a suggestion), **Not matched** (no suggestion, or marked “not related to Clubwerk”) and **Matched**. The columns: From, Suggestion or Matched to, Date, Purpose, Amount. A suggestion carries the label certain, probable or maybe.

- **Apply** accepts the only suggestion. **Apply all certain (n)** at the top right does all clear cases at once.
- **Check …** and **Match …** open the matching window.
- **Lift** takes a match back; item, collection and invoice are then as before.

![Matching a payment: suggestions and manual search.](bild: seite=kontoauszug; klick=[data-f="nicht"]; klick2=[data-kchk]; ziel=dialog)

#### Matching and returned debits

In the window you see date, amount, payer and purpose, below them the **suggestions** and the search **Match by hand**. For a **returned debit** you also set the **charge for the payer** and whether the **mandate is blocked**. **Not related to Clubwerk** hides the transaction; it is deleted after the retention period (Settings › Privacy, default 90 days).

> To match you need the “Bank statement” permission and also “Collection” or “Accounting”. Otherwise you only see the transactions.

### Page “Users & permissions” {#benutzer}

Everyone logs in with their own username, so it is clear who changed what. **Roles** bundle permissions, for example for the treasurer.

### Tab “Users” {#benutzer-benutzer}

![Tab “Users”: name, access, last login.](bild: seite=benutzer; tab=benutzer)

The list shows each user's name, username, the roles or “all permissions” and the last login. Locked users are grey.

![New user: choose a member or create manually, then grant access.](bild: seite=benutzer; tab=benutzer; klick=#uNew; ziel=dialog)

**+ New user:**
- **Select member** (the username is created automatically) or **Create manually** with first and last name.
- Give the **start password** (at least 8 characters) to the person in person.
- **Access:** “By role” (tick roles, plus single extra permissions) or “All permissions” (like the admin account; confirm with your own password).
- **Departments:** for roles with “own department” you decide which departments they apply to.

When editing: **Access active** locks or opens an account, **Set new password** and **Delete user** (log entries stay). The **admin account** always has all permissions and can be neither locked nor deleted.

### Tab “Roles” {#benutzer-rollen}

![Tab “Roles”: bundled permissions.](bild: seite=benutzer; tab=rollen)

A role has a name, a description and permissions. The list shows how many users have it.

![Editing a role: name, description, “Only own departments” and permissions.](bild: seite=benutzer; tab=rollen; klick=[data-r]; ziel=dialog)

**Only members of own departments** is meant for department heads: they only see the members of their department (applies to the “Members” and “Messages” permissions). A role that has users cannot be deleted.

### Tab “Backup” (page “System”) {#sicherung}

![The backup page: key figures and cards.](bild: seite=sicherung; ziel=.kpis)

Every night an **encrypted full backup** is created with everything Clubwerk contains (database, receipts, pictures, modules). It can only be opened with the **backup password**. Three tiles at the top show the last backup, the **test restore** (automatically every Sunday) and the **backup targets**. Yellow or red notes above them report problems.

#### Encryption of personal data

![Card “Encryption of personal data” (vault).](bild: seite=sicherung; ziel=#vaultCard)

The **vault** stores addresses, bank details, birth dates, documents, photos and the like only in encrypted form. Names, accounts and bookings stay readable so that operation continues at once after a restart. A collapsible section lists exactly what is protected.
- **Switch on encryption:** enter your password, then Clubwerk shows the **recovery code** once. Print **two sheets** (one for the chair, one for the treasurer) and keep them sealed, not in the clubhouse. As a check you then type a few characters of the code.
- **After a restart** the data is locked until an admin logs in. If that is not possible, the recovery code with your password opens it. Until then tablet, bookings, doors and irrigation keep running; emails wait.
- **Create new recovery code** (for example when the board changes; the old one then no longer works) and **Switch off encryption** need your password.

#### Now

![Card “Now”: back up immediately, download.](bild: seite=sicherung; ziel=.card:has(#bkRun))

**Back up now** and **Download last full backup**. The file (`.cwbackup`) is encrypted and makes a good second copy off site, for example on a USB stick.

#### Test restore

![Card “Test restore”: result and counts.](bild: seite=sicherung; ziel=#bkProbeCard)

A backup is only as good as its restore. That is why Clubwerk runs a test **every Sunday** after the backup:
- It downloads the latest backup **from one backup target in turn** (without a target it uses the file here) and compares it with the file here (checksum).
- It **starts itself in isolation with this backup**, just as after a total failure, and counts the most important data: accounts, members, open items, sales, court bookings, receipts and more. Nothing here is changed.
- If a number in the backup is **less than half** of today's (for example 3 instead of 412 members), a yellow note “Backup looks incomplete” appears. If the backup is damaged or unreadable, there is a red warning, also on the overview, and an e-mail to the security address.

**Check now** starts the test immediately (one to three minutes depending on size). In addition, Clubwerk checks after **every** upload that the file has arrived complete at the target.

Good to know: if the whole device fails, Clubwerk itself can no longer warn you. So look into the administration now and then. If it says “No successful backup for more than two days”, check at once.

#### Backup password

![Card “Backup password”.](bild: seite=sicherung; ziel=.card:has(#bkPwSet))

The password encrypts all backups, at least 10 characters. **Without the password a backup is worthless.** After setting it, print the **emergency sheet**: password, where the backups are and the steps to restore after a total failure. When you **change** it, older backups stay readable with the old password, so keep the old sheet. Only a user with all permissions may set and change it.

**Password check:** half a year after setting it (or after the last check) the card asks: “Does the backup password you wrote down still match?” Tap **Check password …** and enter the password from the emergency sheet. If it does not match, set a new one and print the emergency sheet again.

#### Schedule & retention

![Card “Schedule & retention”.](bild: seite=sicherung; ziel=.card:has(#bkHour))

Time of the nightly backup and how many daily, weekly and monthly backups are kept. “Also upload readable extracts” adds unencrypted Excel files of the modules. That is convenient but not encrypted, so Clubwerk asks for your password when you switch it on.

#### Backup targets

![Card “Backup targets”: where the nightly backup also goes.](bild: seite=sicherung; ziel=.card:has(#tgAdd))

Where the full backup also goes every night. Two targets in different places are safest. **Add target …** knows WebDAV (Nextcloud, NAS, Storage Box), SFTP and FTP/FTPS (for example FRITZ!Box); **Connect Dropbox …** sets up Dropbox (you confirm saving the keys and connecting with your password). Each target has **Test** and **Edit** (including its own retention); the “Edit” window has **Remove …** on the left. Old unencrypted files from earlier versions in Dropbox can be deleted.

> Dropbox: before connecting for the first time, tick `files.content.write`, `files.content.read`, `files.metadata.read` and `account_info.read` under **Permissions** in the Dropbox app and click **Submit**. Without the ticks for files, Dropbox refuses to save, often just with “other” and no reason. If you change the ticks later, use **Reconnect Dropbox …** in Clubwerk, otherwise the old authorisation stays in force. When connecting and on **Test**, Clubwerk creates a small test file and deletes it again; Dropbox only counts as connected if that works. If Dropbox reports an error, the message says what to do (usually first: set the ticks and reconnect), together with a request ID for Dropbox support.

#### Google Drive as a backup target

Google Drive is a target like the others: **Add target …** › type “Google Drive (your own Google app)”. Clubwerk only gets the `drive.file` permission and can therefore only see the files it created itself, not the rest of your Drive. It creates the folder `Clubwerk-Sicherung` in “My Drive” with the subfolders `Komplett` and `Lesbar`. Do not create this folder by hand – Clubwerk would not be able to see it.

Set it up once in the Google Cloud Console (console.cloud.google.com) with the club’s Google account:

1. Project picker at the top › **New Project**, name e.g. “Clubwerk Backup” › **Create**.
2. **APIs & Services › Library** › search for “Google Drive API” › **Enable**.
3. **Google Auth Platform** › **Get Started**: app name e.g. “Clubwerk”, your email address, audience **External**, contact address, agree › **Create**.
4. **Data Access** › **Add or Remove Scopes** › tick `…/auth/drive.file` › **Update** › **Save**.
5. **Audience** › **Publish app** › confirm. The status then reads “In production”. As `drive.file` is not a sensitive permission, Google does not review the app for it.
6. **Clients** › **Create Client** › application type **TVs and Limited Input devices**, name e.g. “Clubwerk” › **Create**. Copy the client ID and client secret.

Then in Clubwerk:

1. Enter the client ID, client secret, name and folder, confirm with your password › **Sign in with Google**.
2. Clubwerk shows a code. On a phone or computer open `google.com/device`, sign in with the club’s Google account, enter the code (**Copy code** helps) and allow access.
3. Clubwerk notices the confirmation by itself, writes, reads and deletes a test file and only then creates the target.

![Window “Reconnect Google Drive”: client ID, client secret and “Sign in with Google”.](bild: seite=sicherung; klick=[data-tgedit="d3m0gdrive"]; klick2=#gdRe; ziel=dialog)

**Edit** changes the name, folder, active and its own retention (Clubwerk tests when saving); **Reconnect …** signs in again – the saved client ID stays if you leave the field empty. **Remove …** (in the same window) only deletes the target in Clubwerk and hands back the sign-in at Google; the backups in Google Drive stay untouched.

![Window “Google Drive” for editing.](bild: seite=sicherung; klick=[data-tgedit="d3m0gdrive"]; ziel=dialog)

> If you leave the Google app in “Testing” status (you then have to add your Google account under **Audience › Test users**), the sign-in expires **after 7 days**, and from then on no backups arrive. Clubwerk detects this, shows “Reconnect” here and on the overview straight away and sends a security warning. So it is better to **Publish app** right away. You also need to reconnect if someone removes access in the Google account or the connection was not used for 6 months.

Clubwerk uploads large backups in chunks and continues at the same point after an interruption. It then compares Google’s checksum with the file here. If Google throttles because of too many requests, Clubwerk waits and tries again. If the Google account’s storage is full, the message says so clearly (Drive, Gmail and Google Photos share the storage). Every message names the HTTP status and, if Google provides one, an ID (request ID).

**Switching from Dropbox:** both targets run at the same time. Set up Google Drive, tap **Test**, wait one night and check that the “Google Drive” row reads “OK” and the backup appears in the list under **Restore**. Then tap **Check now** for the test restore (Google Drive takes its turn too). Only after that use **Edit** › **Disconnect** for Dropbox. The files in Dropbox and in Google Drive are kept.

#### Restore

![Card “Restore”: backups here and on the targets.](bild: seite=sicherung; ziel=.card:has(#bkUp))

A full backup replaces **everything** at the next restart. The current state is set aside first. Choose the backup in the list (here or on a target) and tap **Restore …**, or load a file with **Upload full backup …**, for example after a new installation. Then “Restart now”. Only a user with all permissions may do this.

#### Take over from backup

![Window “Take over from backup”: choose a backup and enter the password.](bild: seite=sicherung; klick=#tlOpen; ziel=dialog)

Fetches **only individual parts** from a full backup without replacing the current state, for example the items with images from the old backup after a fresh installation. This is how it works:

1. Tap **Take over from backup …**, choose the backup (here, on a target or **File from this device …**) and enter the backup password (empty = the one set here). If the backup contains a vault and you want to take over confidential data (e.g. company contacts in accounting), enter the recovery code or the password of an admin at that time under **Backup vault**.
2. **What to take over?** Each module lists its parts with tick boxes and counts. For sales you can choose items (with images), supplier assignments, the category order and the tablet accounts separately; for the other modules the whole setup (courts, departments and fee types, doors …), plus club name, address, logo and colour. If a part needs another one, Clubwerk ticks it automatically and says why. Modules that are not switched on here are locked.
3. **Preview** shows “x new, y updated, z unchanged” per module. Nothing has been changed yet.
4. **Take over** with your password. Clubwerk creates a snapshot first (see below); afterwards the action is recorded in the log.

Same name → updated, otherwise new. **Nothing is deleted.** Taking over twice does not create duplicates. Accounts keep a PIN that has already been set here; open amounts, bookings and sales are not included. If member management is switched on, members are only created there: existing member accounts are completed, new ones are not created. The backup is only opened in your Clubwerk, passwords are not stored. Only a user with all permissions may do this.

#### Database snapshots

Clubwerk also backs up just the database every night (the last 14 nights), handy for quickly undoing a mistake from the last few days. **Snapshot now** creates one, **Import .db file …** uploads one, and each entry can be downloaded or restored. To download, Clubwerk asks for your password, because the snapshot also contains the backup keys.

### Tab “Log” (page “System”) {#protokoll}

![The log: time, who, action and details.](bild: seite=protokoll; fuelle=#aq::Nachricht)

Who changed what, and when? The last 500 entries: logins, cancellations, transfers, closings, price changes, deliveries, backups. The field **Filter** searches by name or action. Failed logins are grey. Secrets (passwords, PINs) and message texts are never in it. Clubwerk deletes older entries according to the periods under Settings › Privacy.

### Page “Settings” {#einstellungen}

Everything that applies to the whole club. The areas are tabs at the top. What you see depends on your permissions.

### Area “Club” {#einstellungen-verein}

![Card “Club”: name, colours and address.](bild: seite=einstellungen; klick=[data-sec="verein"]; ziel=.card:has(#clubColor))

- **Club name, street, postcode and town, email, phone:** appear on invoices, membership documents and certificates. All modules read them from here. The **club name is mandatory**: the setup assistant asks for it when creating the account. If it is missing, data quality reports “Club name missing” in red, and no emails or notifications go out to members until it is entered.
- **Club colour** and **second colour** (optional): The club colour applies to tablet, admin area, member app, irrigation and Excel. If it is too light for text, Clubwerk darkens it automatically (and lightens it in dark mode). The preview shows light and dark.

![Card “Club logo”.](bild: seite=einstellungen; klick=[data-sec="verein"]; ziel=.card:has(#logoPrev))

**Club logo:** SVG, PNG, JPG or WebP, up to 2 MB. After uploading, Clubwerk suggests the colours from the logo; a click takes one as club colour.

![Card “Club language”.](bild: seite=einstellungen; klick=[data-sec="verein"]; ziel=.card:has(#clubLangBody))

**Club language:** for tablet, member app, emails, Excel and PDF, and the default for everyone. Anyone can choose another for themselves in “My account”.

![Card “Sidebar”: rename and order areas, move entries.](bild: seite=einstellungen; klick=[data-sec="verein"]; ziel=.card:has(#nvRows))

**Sidebar:** This is how the admin menu is arranged, for everyone who signs in. Each of the six areas has a row with its name (leave empty for the default name, up to 24 characters) and arrows ↑ ↓ that move it in the order. Below are the area’s menu entries: with the selector on the right you put an entry into another area, with the arrows you order it within the area. You cannot add new areas or delete one; an area without entries does not appear in the menu. New modules appear at the end of their default area by themselves. Your own names stay exactly as you write them in every language, and also appear in the page header and in the menu button on phones (a very long name does not fit next to the club name there: the button then says “Menu” and the area is shown in the page header); the manuals keep using the default names. What someone may see is still decided by their permissions. **Save** applies to everyone at once, **Restore default** (with a confirmation) restores names, order and assignment. The setting is also part of “Take over from backup” (part “Club”).

### Area “Bank accounts” {#einstellungen-bank}

![Card “Bank accounts”.](bild: seite=einstellungen; klick=[data-sec="bank"]; ziel=.card:has(#bankBody))

The club's bank accounts, shared by accounting, direct debits and the bank statement. **+ Bank account** creates one: name, account holder, IBAN, BIC, bank, **default account** and optionally departments (invoices of these departments name this account). Inactive accounts are kept.

### Area “Bookkeeping” {#einstellungen-buchfuehrung}

Here Clubwerk prepares everything for your tax adviser and for a tax audit (German principles of proper electronic bookkeeping, GoBD). Clubwerk does not replace bookkeeping: it hands the incoming payments that run through Clubwerk to your tax adviser, cleanly separated.

![Card “Change journal”: entries, start and chain check.](bild: seite=einstellungen; klick=[data-sec="buchfuehrung"]; ziel=.card:has(#gbJournal))

**Change journal:** Clubwerk records every new, changed or deleted row involving money or receipts – when, who, before and after. This covers sales, tabs, events, deliveries, article prices, charges, direct debits, dunning, invoices, donation receipts and entry fees. Each entry is chained to the previous one; **Check now** verifies that nothing is missing or altered (also every night in Data quality). The journal is kept for at least 10 years, even after a member has been anonymised, and cannot be set shorter under Privacy.

Clubwerk saves invoices, cancellation invoices and donation receipts as a PDF file when they are created. After that you always get exactly this file, even if the address or tax number changes later. Deleted delivery receipts stay in the recycle bin for 11 years.

![Card “Tax adviser and cash accounts”.](bild: seite=einstellungen; klick=[data-sec="buchfuehrung"]; ziel=.card:has(#gbKonten))

**Tax adviser and cash accounts:** You get the adviser number and client number from your tax adviser, plus the start of the financial year, the account number length (usually 4) and the chart of accounts. Enter a cash account for each payment method (cash, card, direct debit, bank transfer, offsetting). If your tax adviser imports the bank statements directly, use a transit account for direct debit and bank transfer – the batch then splits the collective direct debit into revenue types without double entries.

![Card “Revenue types”: account and sphere per revenue type.](bild: seite=einstellungen; klick=[data-sec="buchfuehrung"]; ziel=.card:has(#gbErl))

**Revenue types:** Each kind of income gets an account and a sphere: non-profit area, asset management, special-purpose operation or commercial operation. Revenue types are, for example, sales per article category, membership and section fees, admission fees, invoices per VAT rate, court and floodlight fees and entry fees. Clubwerk suggests spheres; agree accounts and assignment with your tax adviser (for clubs, for example SKR 42 or SKR 49). **Save** stores both cards.

![Card “DATEV booking batch” with preview.](bild: seite=einstellungen; klick=[data-sec="buchfuehrung"]; klick2=#gbPrev; ziel=.card:has(#gbExport))

**DATEV booking batch:** Choose a period (within one financial year). **Preview** shows the totals per sphere and revenue type, warns above €45,000 in special-purpose operations or €50,000 in commercial operations and lists missing accounts. **Download** creates the file in DATEV format (EXTF). It contains all incoming payments – fees and charges, invoices, cash and card sales, entry fees. Returned direct debits, cancellations and “open again” appear as reversing entries. Your tax adviser books expenses and bank transactions outside Clubwerk as before. Agree the first export with them.

**Data provision for the tax audit:** A ZIP for one year in the tax authorities' description standard (index.xml with CSV files): all tables with money and receipts, the change journal and the incoming payments. PINs, passwords and account numbers are not included.

**Previous exports:** When, by whom, which period, how many entries and which total. “changed since” means something in the period was recorded, cancelled or reversed later. Export the period again and tell your tax adviser.

### Area “Mailbox” {#einstellungen-mail}

![Card “Mailbox”: SMTP access and test email.](bild: seite=einstellungen; klick=[data-sec="mail"]; ziel=#mailCard)

One mailbox for all modules: server (SMTP), port (usually 587, sometimes 465), sender address, user and password. Your provider lists the details under “SMTP” or “outgoing mail server”; for Gmail use an app password. **Save mailbox**, then **Send test email**. The password is never shown again and is in no export.

### Area “Reachability” {#einstellungen-erreichbar}

![Card “Club network”.](bild: seite=einstellungen; klick=[data-sec="erreichbar"]; ziel=#apNet)

- **Club network:** which networks count as the clubhouse (for example `192.168.10.0/24`, comma-separated). Empty = any private address. With your network entered, guest Wi-Fi or VPN cannot reach the admin area and tablet. “Take over my network” enters the current network. The Home Assistant sidebar always works. “Allow direct connections from the internet” is not recommended.
- **Further addresses:** names under which the admin area can be reached, for example your own DuckDNS address. Protection against attacks via other websites.
- **Encryption and access from outside:** shows whether HTTPS is on (in Home Assistant under Add-on › Configuration “HTTPS for all devices”). You set up access on the go under Member app › Settings.

### Area “Security” {#einstellungen-sicherheit}

![Card “Security warnings”: open warnings with time, type and a “Done” button.](bild: seite=einstellungen; klick=[data-sec="sicherheit"]; ziel=.card:has(#swBody))

Clubwerk notices anything unusual and tells the committee – without any internet service, everything runs on your Home Assistant. Examples are many wrong passwords or PINs, a locked phone, a sign-in from a new device, changed users and permissions, an uploaded extension, the vault opened with the recovery code, changed backup destinations, a failed backup, low storage, new errors in the data, and also operational hazards: irrigation that cannot be stopped, a door that does not lock or a light that cannot be switched.

- **Red** arrives at once by push and email, at night too. The same warning comes at most once an hour, and at most ten immediate messages a day; after that one last note arrives and the rest is listed here.
- **Yellow** arrives collected in the **daily email at 7 am**, only on days with new warnings.
- **Only here** (grey) is only listed here and in the log, for example an installed update.

Identical warnings are combined; the number in brackets shows how often it happened. **Done** removes a warning from the list and the overview – for all recipients; the log records who did it. **All done** clears the whole list, **Also show done ones** brings them back. **Send test warning** sends a red test through every channel. Clubwerk deletes warnings after the period “Sign-ins and security messages” (Settings › Privacy).

![Card “Who receives warnings?”: recipients with push and email, additional addresses.](bild: seite=einstellungen; klick=[data-sec="sicherheit"]; ziel=.card:has(#swWho))

**Who receives warnings?** All users with the permission “Security warnings”; anyone with “all permissions” gets them automatically. Push goes to the phone of the member the user is linked to (Users & permissions), as soon as notifications are on there and the occasion “Security warning” is released under Member app › Notifications. The push only names the type of warning, never names or addresses. The email goes to that member’s address. **Additional addresses** (for example a committee mailbox) receive every email too; only users with the permission “Settings” may enter them, and every change is itself a warning. If the vault is still locked after a restart, emails only go to the additional addresses.

### Area “Privacy” {#einstellungen-datenschutz}

![Card “Retention periods”: one period per kind of data.](bild: seite=einstellungen; klick=[data-sec="datenschutz"]; ziel=.card:has(#dsBody))

**Retention periods:** Clubwerk deletes once a day whatever is older than the period (for example logins, door openings, irrigation, circular emails, change log). Only the number goes into the log. Each line shows how many entries drop out at the next run. Clubwerk never deletes money and working hours by itself; the bookkeeping change journal is kept for at least 10 years. **Save** applies, **Delete now** starts the run immediately. The periods are suggestions; if in doubt, agree them with your data protection officer.

![Card “Privacy notice in the member app”.](bild: seite=einstellungen; klick=[data-sec="datenschutz"]; ziel=.card:has(#dsNotice))

**Privacy notice in the member app:** Members see the text the next time they open the app (and after every change) and at any time under “My account”. **Insert template** fills in a sample text. Empty = no notice.

**Record of processing activities:** **Print record** produces a template under Art. 30 GDPR from all modules that are switched on. You add the controller and the services used.

### Area “Data quality” {#einstellungen-daten}

![Card “Data quality”: findings with reason and button.](bild: seite=einstellungen; klick=[data-sec="daten"]; ziel=.card:has(#dqBody))

Every night Clubwerk checks whether the data fit together, for example: direct debit payers without a valid mandate, direct debits not yet booked as paid, family members without a head of family, open items of deleted members, deleted accounts with an open balance and expired invitations. Each finding says why it causes harm and has a button that takes you to the place where you fix it. Clubwerk never corrects money by itself. **Errors** (red) also appear in the overview. **Check now** runs the check straight away. Modules can add their own checks.

### Area “Tablet” {#einstellungen-tablet}

![Card “Tablet in the clubhouse”: with or without a tablet.](bild: seite=einstellungen; klick=[data-sec="tablet"]; ziel=#tmCard)

**Tablet in the clubhouse:** “With a tablet” or “Without a tablet”. Without a tablet the tablet address leads straight to the admin login, there are no tablet pages and no tablet password. When switching on you set the password first. Switching off signs out all tablets.

![Card “Tablet password”.](bild: seite=einstellungen; klick=[data-sec="tablet"]; ziel=#tpCard)

**Tablet password** (at least 8 characters): **mandatory** as long as the tablet is on. Each device enters it once and then stays authorised for up to 400 days. A new password or **Sign out all devices …** locks all devices so far, handy when the password has done the rounds.

![Card “Tablet bar”: order, visibility and start tab.](bild: seite=einstellungen; klick=[data-sec="tablet"]; ziel=.card:has(#toRows))

**Tablet bar:** The modules and links in the header, from left to right. The switch “show on the tablet” takes effect at once. Order and **start tab** (opens when the address is called and after 30 seconds without input) apply after **Save**.

**Appearance on the tablet:** Like the device, Light, Dark or **High contrast** (strong borders and heavier type, good in sunlight at the bar). Applies to all tablets.

**Links in the header:** Up to 8 own links (label and address) that appear at the top next to “Admin”. Some pages forbid embedding; then the area stays empty.

**Tablet & Home Assistant:** the tablet address (`…:3100`) and the note on the figures for Home Assistant.

### Area “Modules” {#einstellungen-module}

![One row of the module list: description, buttons “User guide (PDF)” and “Demo”, version, status and switch.](bild: seite=einstellungen; klick=[data-sec="module"]; ziel=#modList .mrow:nth-child(4))

All modules with description, version, status and the **“Active” switch**. Off means hidden; the data stays. Each module has:
- **User guide (PDF):** opens the guide for the module in a new tab. The **“?”** at the top right jumps straight to the matching place.
- **Demo:** tries the module with made-up sample data in a new tab, separate from your data and without switching or sending anything. Only one demo runs at a time. It ends when you close the tab, with “End demo”, after 30 minutes without use or at restart, and is deleted completely.
- **Export settings / Import settings …:** takes a module's settings to another Clubwerk installation (without PINs, keys and data). Before the import a dialogue shows what would happen (“This would happen: …”); nothing is saved until you press “OK”. On import, entries with the same name are updated, new ones are created and nothing is deleted; the message says how many were new and how many were updated.
- **⋯ Uninstall …:** deletes module and data, but only after a **mandatory backup** that you must download and after typing the module name. With **Install** a module comes back later, if you wish with the saved data.
- **Install extension (ZIP) …:** uploads an additional module (only with all permissions). It only runs after “Check & approve …” with your password and a restart, because an extension is program code.

### Area “Languages” {#einstellungen-sprache}

![Card “Languages”: existing languages and the way to a new one.](bild: seite=einstellungen; klick=[data-sec="sprache"]; ziel=.card:has(#langBody))

The table shows all languages with code, origin and completeness. German and English are included. For **a new language or a better translation**: download the template as JSON (for an AI) or Excel, have it translated and load it back with **Import file …**. The same works to adjust single terms (for example “players” instead of “members”). Large files may come in parts.

### Area “Update” {#einstellungen-update}

![Card “Update of Clubwerk”.](bild: seite=einstellungen; klick=[data-sec="update"]; ziel=#updCard)

Only with all permissions. The card shows the installed version, a package that is ready, the last update and the Node.js version (with a note if “Rebuild” in Home Assistant is needed). **Upload ZIP package …**: Clubwerk checks the package and shows the checksum to compare with `PRUEFSUMMEN.md`. With your own password “Apply update to …” starts it; Clubwerk first makes an automatic backup. Home Assistant then builds the new version (2 to 10 minutes). The old version stays as a **reserve**; **Back to …** goes back, the data stays. Updates only work if the admin area is open through the Home Assistant sidebar.

### Page “My account” {#konto}

![Card “My password”.](bild: seite=konto; ziel=.card:has(#savePw))

Everything that applies only to you. You reach the page through your name at the bottom of the menu.

- **My password:** current and new password.

![Card “Display in this browser”: language and appearance.](bild: seite=konto; ziel=.card:has(#themeSel))

- **Display in this browser:** your language (default: like the club) and the appearance: Like the device, Light, Dark or High contrast. Applies at once and only in this browser.
- **My email sender** (with the “Messages” permission): reply address and signature for your messages.

## Tablet and app {#tablet-app}

![The “For me” start page in the member app.](bild: app=start)

**Member app:** With the QR code and PIN the app opens on the phone. The icon at the top (profile picture) and “More” at the bottom open “My account”: profile picture, notifications, language, appearance, **Change PIN** (with the old PIN; it also applies on the tablet) and **Log out** (only unpairs this phone; it then needs a new invitation). The app always stays inside itself and never opens a new window. The **Messages** section shows the club's messages: newest first, unread in bold, pinned at the top.

![The “My account” sheet in the app.](bild: app=mehr)

![Messages in the member app.](bild: app=nachrichten)

**Tablet:** Open the clubhouse tablet in the browser at the tablet address (`…:3100`) and enter the tablet password once. The device then stays authorised. The header at the top shows the modules in the order you set under Settings › Tablet. The tablet returns to the start tab after 30 seconds without input, and every action by name asks for the member PIN. Whoever has no PIN yet sets one the first time on the tablet.

![The start page of the tablet with the header.](bild: tablet=start; hoehe=520)

## Permissions {#rechte}

| Permission | What it allows |
|---|---|
| Settings | Settings, backup, log, setup, update, member app (address, security, SMS, push occasions), switching modules on and off and starting a demo |
| Users | Manage users and roles (page “Users & permissions”) |
| Set up the member app (App) | Change sections, tabs, notifications and name of the app; address and security only with “Settings” |
| Create members & confirm new ones (Accounts) | Manage accounts and PINs, confirm new entries from the tablet, authorise members in the app |
| Messages (Email) | Write messages to members (email, app, push) |
| Bank statement | Read in and match bank statements (also needs “Collection” or “Accounting”) |
| Modules (Uninstall) | Uninstall and reinstall modules (with mandatory backup) |
| Security warnings | Receive security warnings by push and email, view them under Settings › Security and mark them as done |

The **admin account** always has all permissions, as do users with “All permissions”. The backup password, backup targets, restoring and updates are for a user with all permissions only. “My account” and the overview are open to every logged-in user.

## Working with other modules {#zusammenspiel}

- **All modules** report their notes to the overview, their steps to the setup, their sections to the member app, their occasions to the push list, their retention periods to privacy, their data to the data request and their pages to search.
- **Members:** With the member administration, members are only created there. Messages reach groups and departments, invitations read the address and mobile number from there, department heads only see their department. The bank statement matches fees and returned debits.
- **Accounting:** The bank statement also matches invoices; the bank accounts apply to both.
- **Sales:** The accounts and PINs on the tablet; without the member administration the accounts are the members themselves.
- **Access and irrigation:** Authorisation in the app respects the club network. Without Wi-Fi or SMS confirmation both only unlock in the club Wi-Fi.
