# Clubwerk Basics
<!-- kurz: Admin area, setup, accounts, member app, permissions, backup, messages and settings – everything that applies to the whole club. -->

## What is this module for? {#wofuer}

This is the core of Clubwerk. It is part of every installation and contains everything that does not belong to a single module: the overview, the setup assistant, accounts and PINs, the management of the member app, users and permissions, backup, the log, messages to members, the bank statement and the settings for the whole club.

You switch modules (Sales, Courts, Defects …) on under Settings › Modules. The core also works with no modules at all. You reach it in the admin area through “Overview” and the “Club” menu group.

## Setting up {#einrichten}

1. **First start:** Open Clubwerk in the Home Assistant sidebar. You see “Welcome to Clubwerk”. Choose the language and tap “Start setup”. (With “Try the demo” you can get to know Clubwerk first, using made-up data.)
2. **Create the admin account:** name, username and password (at least 8 characters). This account has all permissions.
3. **Work through the assistant:** It guides you through club, tablet, modules, security, mailbox and backups (see “Setup” below). Every item can be skipped and done later.
4. **Create more users:** Under Users & permissions everyone gets their own account with the permissions they need.

> Two things should be done straight away: set a **backup password** (Backup) and print the **emergency sheet**. Without them a backup is worthless.

## Admin area {#verwaltung}

The menu is on the left. At the top of the menu, **Search** (shortcut Ctrl K or ⌘K) finds pages, settings, actions and people. Your name is at the bottom: a click opens “My account”; next to it the tablet icon opens the tablet page in a new tab and the arrow logs you out. Via **Admin** in the tablet header, Clubwerk logs you out after one minute without input; a login directly in the admin area (for example in the Home Assistant sidebar) is not affected, even in the same browser. The **“?”** at the top right opens the guide for the area you are in, as a PDF.

### Page “Overview” {#uebersicht}

![The overview: greeting, setup progress, “To do” and the grid of modules.](bild: seite=uebersicht)

The overview is your home page. It shows what matters today.

#### Setup … % complete

A single line with a bar. “All items” opens the “Setup” page, “Continue setup” jumps to the next open item. It disappears once everything is done.

#### To do

![The “To do” card with coloured notes. Red notes come first.](bild: seite=uebersicht; ziel=.todo)

Notes from the core and from all modules appear here: missing backup password, encryption switched off, no club network, new entries from the tablet to confirm, low stock and much more. Red is urgent, yellow is a note. Six notes are visible, “Show all” opens the rest. The link at the end of a line takes you straight to where you fix it. You only see notes you are allowed to deal with.

#### Grid of modules

![The grid of modules: name, state and the most important figure.](bild: seite=uebersicht; ziel=.mods2)

Every module that is switched on has a tile with its state (Running, Note, Fault) and its most important figure. A click opens the module. Below, if there is anything, you find “Low stock” and “Latest deliveries” from Sales.

> On a phone, the icon at the top left labelled “Menu” opens the menu bar.

### Page “Setup” {#einrichtung}

![The “Setup” page: open, done and hidden items.](bild: seite=einrichtung; ziel=.card:has(.wizbar))

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
- **Send by email:** a personal link, valid for a few days. Needs a mailbox and the address in the member administration.
- **Print invitation letter:** QR code with instructions on paper.
- **Release doors and irrigation now:** only appears if a phone was paired from outside without an SMS code.

#### Authorised members

The list shows each member's phone state (phone authorised, QR code open, invitation expired, locked) and a tick per section to authorise. The filters “with phone”, “without phone”, “invited”, “waiting for Wi-Fi” and “old address” help with tidying up. At the end of a row the envelope button invites again and the bin removes: **Remove phone only** (with a new QR code the member is back) or **Remove from the app entirely**. **Send invitations …** invites many people at once by email or as letters.

> A new QR code, or authorising a new section, can sign the old phone out for security reasons. Simply invite again.

### Tab “Sections” {#app-bereiche}

![Tab “Sections”: which sections the app shows, for whom and in what order.](bild: seite=app; klick=[data-sec="bereiche"])

One table for all sections of the app, one “Save” for everything:
- **Switch:** Off = the section disappears for everyone, authorisations stay.
- **For whom:** “all members” or “selected only” with a count.
- **On the go:** Without the tick the section only works in the club Wi-Fi (only with the “Settings” permission).
- **When unlocking:** “preselect” ticks the section for new members automatically.
- **Start** and **↑ ↓:** start section and order. By default the app opens “For me”.

“For me” is always first. It is the start page of the app with the cards “New for you”, “Coming up”, “To do” and “My account”. Open replies to dates and match days appear only as a note (“Dates: n replies open”, “Match days: n replies open”), with no buttons and no time limit. If a member has a bar tab, a tick at the bottom also shows it under “For me”.

### Tab “Notifications” {#app-push}

![Tab “Notifications”: occasions of one module.](bild: seite=app; klick=[data-sec="push"]; ziel=#pushCard > div:nth-of-type(2))

![Test message to a member.](bild: seite=app; klick=[data-sec="push"]; ziel=.row:has(#pshWho))

Push messages are short notes on the phone (on iPhone only in the home-screen app from iOS 16.4). At the top it shows how many phones are registered. For each module you tick the **occasions** for which a note is sent (for example new message, reminder of a date, new defect report); some have a lead time. Each member only switches push on or off per phone; what is allowed is decided by you. At the bottom **Test message to** sends a note to a member. “Recently sent” shows the latest notes and whether they arrived. Only a title and one sentence are sent, never anything that needs a PIN.

### Tab “Settings” {#app-einstellungen}

This is where the cards for the address and security of the app are.

#### Address & appearance

![Card “Address & appearance”: address in the club Wi-Fi, name on the home screen and access from outside.](bild: seite=app; klick=[data-sec="einstellungen"]; ziel=#apSet)

- **Address in the club Wi-Fi:** phones reach the app at this address. It ends up in the QR code. Empty = the address at which you currently have the admin area open. Addresses with “.local” do not open on some phones; better without “.local” or with an IP address.
- **Name on the home screen:** at most 20 characters.
- **Public address** and **Reachable on the go:** for access from outside via a Cloudflare Tunnel. Only the member app becomes reachable; admin area, tablet and irrigation stay in the club Wi-Fi. The steps are on the card in a collapsible section. **Check connection** tests the route, **Test ↗** opens the app.

If a tunnel is on, the card **Tunnel source** appears: you decide from which address in the Home Assistant network the tunnel may come. This stops another add-on from posing as the tunnel (recommended).

#### Security

![Card “Security”: validity of invitations and warning address.](bild: seite=app; klick=[data-sec="einstellungen"]; ziel=#apSec)

How long a QR code (1 hour, 1 day or 7 days) and an email/letter (2, 7 or 14 days) are valid, who is warned about a locked phone, and whether the QR code is also offered as a link to pass on (less secure). After 5 wrong PINs the phone is locked for 5 minutes, from the 10th wrong attempt for 30 minutes, then completely: only a new QR code helps.

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

### Page “Backup” {#sicherung}

![The backup page: key figures and cards.](bild: seite=sicherung; ziel=.kpis)

Every night an **encrypted full backup** is created with everything Clubwerk contains (database, receipts, pictures, modules). It can only be opened with the **backup password**. Three tiles at the top show the last backup, the **test restore** (automatically once a month) and the **backup targets**. Yellow or red notes above them report problems.

#### Encryption of personal data

![Card “Encryption of personal data” (vault).](bild: seite=sicherung; ziel=#vaultCard)

The **vault** stores addresses, bank details, birth dates, documents, photos and the like only in encrypted form. Names, accounts and bookings stay readable so that operation continues at once after a restart. A collapsible section lists exactly what is protected.
- **Switch on encryption:** enter your password, then Clubwerk shows the **recovery code** once. Print **two sheets** (one for the chair, one for the treasurer) and keep them sealed, not in the clubhouse. As a check you then type a few characters of the code.
- **After a restart** the data is locked until an admin logs in. If that is not possible, the recovery code with your password opens it. Until then tablet, bookings, doors and irrigation keep running; emails wait.
- **Create new recovery code** (for example when the board changes; the old one then no longer works) and **Switch off encryption** need your password.

#### Now

![Card “Now”: back up immediately, check, download.](bild: seite=sicherung; ziel=.card:has(#bkRun))

**Back up now**, **Check last backup** and **Download last full backup**. The file (`.cwbackup`) is encrypted and makes a good second copy off site, for example on a USB stick.

#### Backup password

![Card “Backup password”.](bild: seite=sicherung; ziel=.card:has(#bkPwSet))

The password encrypts all backups, at least 10 characters. **Without the password a backup is worthless.** After setting it, print the **emergency sheet**: password, where the backups are and the steps to restore after a total failure. When you **change** it, older backups stay readable with the old password, so keep the old sheet. Only a user with all permissions may set and change it.

#### Schedule & retention

![Card “Schedule & retention”.](bild: seite=sicherung; ziel=.card:has(#bkHour))

Time of the nightly backup and how many daily, weekly and monthly backups are kept. “Also upload readable extracts” adds unencrypted Excel files of the modules. That is convenient but not encrypted.

#### Backup targets

![Card “Backup targets”: where the nightly backup also goes.](bild: seite=sicherung; ziel=.card:has(#tgAdd))

Where the full backup also goes every night. Two targets in different places are safest. **Add target …** knows WebDAV (Nextcloud, NAS, Storage Box), SFTP and FTP/FTPS (for example FRITZ!Box); **Connect Dropbox …** sets up Dropbox. Each target has **Test**, **Edit** (including its own retention) and **Remove**. Old unencrypted files from earlier versions in Dropbox can be deleted.

#### Restore

![Card “Restore”: backups here and on the targets.](bild: seite=sicherung; ziel=.card:has(#bkUp))

A full backup replaces **everything** at the next restart. The current state is set aside first. Choose the backup in the list (here or on a target) and tap **Restore …**, or load a file with **Upload full backup …**, for example after a new installation. Then “Restart now”. Only a user with all permissions may do this.

#### Database snapshots

Clubwerk also backs up just the database every night (the last 14 nights), handy for quickly undoing a mistake from the last few days. **Snapshot now** creates one, **Import .db file …** uploads one, and each entry can be downloaded or restored.

### Page “Log” {#protokoll}

![The log: time, who, action and details.](bild: seite=protokoll; fuelle=#aq::Nachricht)

Who changed what, and when? The last 500 entries: logins, cancellations, transfers, closings, price changes, deliveries, backups. The field **Filter** searches by name or action. Failed logins are grey. Secrets (passwords, PINs) and message texts are never in it. Clubwerk deletes older entries according to the periods under Settings › Privacy.

### Page “Settings” {#einstellungen}

Everything that applies to the whole club. The areas are tabs at the top. What you see depends on your permissions.

### Area “Club” {#einstellungen-verein}

![Card “Club”: name, colours and address.](bild: seite=einstellungen; klick=[data-sec="verein"]; ziel=.card:has(#clubColor))

- **Club name, street, postcode and town, email, phone:** appear on invoices, membership documents and certificates. All modules read them from here.
- **Club colour** and **second colour** (optional): The club colour applies to tablet, admin area, member app, irrigation and Excel. If it is too light for text, Clubwerk darkens it automatically (and lightens it in dark mode). The preview shows light and dark.

![Card “Club logo”.](bild: seite=einstellungen; klick=[data-sec="verein"]; ziel=.card:has(#logoPrev))

**Club logo:** SVG, PNG, JPG or WebP, up to 2 MB. After uploading, Clubwerk suggests the colours from the logo; a click takes one as club colour.

![Card “Club language”.](bild: seite=einstellungen; klick=[data-sec="verein"]; ziel=.card:has(#clubLangBody))

**Club language:** for tablet, member app, emails, Excel and PDF, and the default for everyone. Anyone can choose another for themselves in “My account”.

### Area “Bank accounts” {#einstellungen-bank}

![Card “Bank accounts”.](bild: seite=einstellungen; klick=[data-sec="bank"]; ziel=.card:has(#bankBody))

The club's bank accounts, shared by accounting, direct debits and the bank statement. **+ Bank account** creates one: name, account holder, IBAN, BIC, bank, **default account** and optionally departments (invoices of these departments name this account). Inactive accounts are kept.

### Area “Mailbox” {#einstellungen-mail}

![Card “Mailbox”: SMTP access and test email.](bild: seite=einstellungen; klick=[data-sec="mail"]; ziel=#mailCard)

One mailbox for all modules: server (SMTP), port (usually 587, sometimes 465), sender address, user and password. Your provider lists the details under “SMTP” or “outgoing mail server”; for Gmail use an app password. **Save mailbox**, then **Send test email**. The password is never shown again and is in no export.

### Area “Reachability” {#einstellungen-erreichbar}

![Card “Club network”.](bild: seite=einstellungen; klick=[data-sec="erreichbar"]; ziel=#apNet)

- **Club network:** which networks count as the clubhouse (for example `192.168.10.0/24`, comma-separated). Empty = any private address. With your network entered, guest Wi-Fi or VPN cannot reach the admin area and tablet. “Take over my network” enters the current network. The Home Assistant sidebar always works. “Allow direct connections from the internet” is not recommended.
- **Further addresses:** names under which the admin area can be reached, for example your own DuckDNS address. Protection against attacks via other websites.
- **Encryption and access from outside:** shows whether HTTPS is on (in Home Assistant under Add-on › Configuration “HTTPS for all devices”). You set up access on the go under Member app › Settings.

### Area “Privacy” {#einstellungen-datenschutz}

![Card “Retention periods”: one period per kind of data.](bild: seite=einstellungen; klick=[data-sec="datenschutz"]; ziel=.card:has(#dsBody))

**Retention periods:** Clubwerk deletes once a day whatever is older than the period (for example logins, door openings, irrigation, circular emails, change log). Only the number goes into the log. Each line shows how many entries drop out at the next run. Clubwerk never deletes money and working hours by itself. **Save** applies, **Delete now** starts the run immediately. The periods are suggestions; if in doubt, agree them with your data protection officer.

![Card “Privacy notice in the member app”.](bild: seite=einstellungen; klick=[data-sec="datenschutz"]; ziel=.card:has(#dsNotice))

**Privacy notice in the member app:** Members see the text the next time they open the app (and after every change) and at any time under “My account”. **Insert template** fills in a sample text. Empty = no notice.

**Record of processing activities:** **Print record** produces a template under Art. 30 GDPR from all modules that are switched on. You add the controller and the services used.

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
- **Export settings / Import settings …:** takes a module's settings to another Clubwerk installation (without PINs, keys and data).
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

The **admin account** always has all permissions, as do users with “All permissions”. The backup password, backup targets, restoring and updates are for a user with all permissions only. “My account” and the overview are open to every logged-in user.

## Working with other modules {#zusammenspiel}

- **All modules** report their notes to the overview, their steps to the setup, their sections to the member app, their occasions to the push list, their retention periods to privacy, their data to the data request and their pages to search.
- **Members:** With the member administration, members are only created there. Messages reach groups and departments, invitations read the address and mobile number from there, department heads only see their department. The bank statement matches fees and returned debits.
- **Accounting:** The bank statement also matches invoices; the bank accounts apply to both.
- **Sales:** The accounts and PINs on the tablet; without the member administration the accounts are the members themselves.
- **Access and irrigation:** Authorisation in the app respects the club network. Without Wi-Fi or SMS confirmation both only unlock in the club Wi-Fi.
