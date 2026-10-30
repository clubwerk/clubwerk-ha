# Time tracking
<!-- kurz: Staff clock in and out at the tablet with a PIN – you get the monthly report with hours and amounts. -->

## What is the module for? {#wofuer}

Employees and helpers who are paid by the hour (for example cleaning, groundskeeper, caretaker) clock in and out at the tablet with their own PIN. Clubwerk stores the real times and works out the hours for each month and, if an hourly rate is set, the amount. Your treasurer receives the monthly report as a PDF (with a signature page for each person) and as an Excel file automatically by email on the 1st of the following month.

The module works on its own. It needs neither Members nor Duties & events: staff are added here and do not have to be club members. The voluntary work hours of members belong to “Duties & events”, not here.

## Setting up {#einrichten}

1. **Settings › Modules:** switch on “Time tracking”. With “Demo” you can try the module with made-up data first.
2. **Give the permission:** under Settings › Users & permissions, give the permission “Time tracking” to everyone who may see hours and hourly rates.
3. **Add staff:** tab “Staff” › “+ Person” (name, activity, PIN, hourly rate).
4. **Set up the mailbox:** Settings › Mailbox, so the monthly report can be sent.
5. **Enter the recipient:** tab “Settings” › card “Monthly report by email” (the treasurer’s address).

As soon as one active person exists, the “Clock in” tab appears at the tablet. The setup assistant (Club › Setup) walks you through the same two steps, “Staff” and “Monthly report”.

## Admin area {#verwaltung}

The “Time tracking” page has three tabs at the top: **Hours**, **Staff** and **Settings**.

### Tab “Hours” {#zeit}

![The “Hours” tab: choose month and person, with four figures and the overview of all people below.](bild: seite=zeit)

Here you see who worked when. At the top are two selection fields, below them four tiles, below them the list.

- **Month:** the current month by default. You can choose any month that has shifts.
- **Person:** “All” shows the overview, one person shows their individual shifts.

#### The four figures

| Tile | Meaning |
|---|---|
| Shifts | Number of completed shifts (clock in and clock out) |
| Exact | Total of the real times |
| Billed (rounded) | The monthly total rounded to the quarter hour |
| Amount | Billed hours times hourly rate. Without an hourly rate it shows “–”. |

> Only the **monthly total** per person is rounded, not each single shift: a remainder of up to 3 minutes is rounded down, from 4 minutes it is rounded up to the next quarter hour. Example: 41:08 hours become 41:15 hours, 41:03 hours stay 41:00 hours.

#### Overview “All people”

One row per person with **Name**, **Activity**, **Shifts**, **exact**, **billed**, **Rate** and **Amount**, with the **Total** at the bottom. Anyone who is clocked in at the moment is marked “here now”. Anyone who forgot to clock out is marked “not clocked out” in red. People who are no longer active stay in the list as long as they have shifts in this month and are marked “inactive”. “Shifts” at the end of a row opens that person’s detail view.

#### Detail view of one person

![The shifts of one person in the month: date, clock in, clock out, duration and notes, with the total below.](bild: seite=zeit; klick=[data-zs])

The list has the columns **Date**, **Clock in**, **Clock out**, **Duration** and **Note**. If a shift runs past midnight, “(+1)” appears after “Clock out”. Below the list are the total and, next to it, how many hours will be billed. Open shifts (not yet clocked out) are not included in the total.

The notes are coloured markers:

- **still here:** the person is clocked in right now.
- **not clocked out:** the shift has been open for more than 12 hours. This is almost always forgotten. Add the end time with “Edit”.
- **added manually:** you entered the shift yourself.
- **corrected by … · before …:** you changed the clocked time. The original time stays visible.
- Your reason appears next to it in grey.

#### “Edit”

![The “Edit shift” window: clock in, clock out, reason and Delete.](bild: seite=zeit; klick=[data-zs]; klick2=[data-ze]; ziel=dialog)

“Edit” in the row opens the window. At the top it shows what was originally clocked. You change **Clock in** and **Clock out** and enter a **Reason**, which also appears in the report (at least three letters, for example “forgot to clock out”). “Save” applies the change. “Delete” at the bottom left removes the shift after a confirmation; a shift that is still running can only be deleted after it has been clocked out.

Clubwerk rejects impossible entries: an end before the start, times in the future, shifts longer than 24 hours and shifts that overlap another shift of the same person. Every change is recorded in the log.

#### “+ Add shift”

![The “Add shift” window: person, clock in, clock out and reason.](bild: seite=zeit; klick=#zAdd; ziel=dialog)

For times that were not clocked (forgotten PIN, tablet was off). Choose the person (only active people are offered), enter **Clock in** and **Clock out**, write a **Reason** and click “Save”. The shift appears marked “added manually”.

#### “Monthly report (PDF)” and “Excel”

![Top right in the tab bar: “+ Add shift”, “Monthly report (PDF)” and “Excel”.](bild: seite=zeit; ziel=.tabrow)

Both buttons are on the right in the tab bar.

- **Monthly report (PDF)** covers the chosen month: with “All” an overview plus one page per person with all shifts and a line for signatures, with a chosen person only that person’s page. The report also shows the notes “added manually” and “corrected”.
- **Excel** gives all people of the month as a table: name, activity, shifts, minutes exact, hours exact, billed, rate and amount, plus a sheet with the individual shifts.

#### Notice when sending failed

If the last automatic sending of the monthly report went wrong, a red bar at the top shows the cause and the link “Settings →”.

### Tab “Staff” {#zeit-personal}

![The “Staff” tab: name, activity, PIN, hourly rate and status.](bild: seite=zeit-personal)

Here you decide who may clock in at the tablet. The hourly rate is visible only here and in the hours overview, never at the tablet. The list has the columns **Name** (surname, first name), **Activity**, **PIN** (only marks that a PIN is set; the PIN itself is never shown), **Hourly rate** and **Status** (active or inactive). Inactive rows are grey.

#### “+ Person” and “Edit”

![The “Add person” window: name, activity, PIN and hourly rate.](bild: seite=zeit-personal; klick=#zpNew; ziel=dialog)

“+ Person” adds a new person, “Edit” in a row changes an existing one. It is the same window:

- **Name:** first and last name.
- **Activity:** free text, for example “Cleaning” or “Caretaker”. It appears under the name at the tablet.
- **PIN:** 4 to 6 digits. When editing, leave the field empty if the PIN should stay the same. Anyone who has forgotten their PIN gets a new one here.
- **Hourly rate in €:** optional, for example “14,00”. Leave empty if no amount should be calculated.
- **active** (only when editing): if you remove the tick, the person no longer appears at the tablet. Their old shifts are kept. This is how you “delete” staff who no longer work for you.

![The window of an existing person with the “active” tick.](bild: seite=zeit-personal; klick=[data-zp]; ziel=dialog)

> If you change the hourly rate, the new rate applies **from the current month**. Closed months keep their old rate. In the window, “Previous rates” lists all changes with their month. For months before the first rate entered, the first rate applies, so that manually added shifts do not end up without an amount.

### Tab “Settings” {#zeit-einstellungen}

The tab has two cards.

#### Monthly report by email

![Card “Monthly report by email”: recipient, Save, test email and send last month now.](bild: seite=zeit-einstellungen; ziel=[data-set="mail"])

On the **1st of every month from 6 am**, Clubwerk sends the report for the previous month to the recipient entered. If Home Assistant was off that day, it is caught up at the next start; if something fails, Clubwerk tries again every hour. Attached are the PDF (overview plus one page per person to sign) and the Excel file. The text lists everyone with billed and exact hours and the amount. If someone has a shift without an end, the email points this out.

- **Recipients:** the treasurer’s email address. Separate several addresses with commas.
- **Save:** stores the recipient.
- **Send test email:** sends a trial email to the recipient without sending a report.
- **Send [last month] now:** sends last month’s report immediately, after a confirmation. Useful if you have corrected a mistake and the treasurer needs the new figures.

A bar above the card shows the state: green with date and recipient when the last report was sent, red after an error, yellow if no mailbox is set up yet (then “Send test email” and “Send now” are greyed out). Sending uses the shared club mailbox under Settings › Mailbox.

#### Transfer settings

![Card “Transfer settings”: export and import.](bild: seite=zeit-einstellungen; ziel=[data-set="transfer"])

Exports the recipient and the active people with activity and current hourly rate to a file that you can import into another Clubwerk installation. Times and PINs are never included. New people get a random PIN on import; assign the real one afterwards under “Staff”. On import, entries with the same name (ignoring upper/lower case) are updated, new ones are created and nothing is deleted. The message says for each kind how many were new and how many were updated.

## Tablet and app {#tablet-app}

![The “Clock in” tab at the tablet: one tile per person with activity and status.](bild: tablet=Clock in; hoehe=430)

![The PIN window after tapping a name.](bild: tablet=Clock in; klick=button[data-id="1"]; hoehe=760)

At the tablet, the **Clock in** tab (address `/zeiterfassung/`) shows one tile per active person, sorted by surname. On the right it shows the person’s state: **here**, **not here** or **forgotten**. Underneath it says “since 08:00” or “last yesterday 16:30”.

How to clock in or out:

1. Tap your own name.
2. Enter your PIN and confirm with “OK”. The circles show how many digits you have typed (a PIN has 4 to 6).
3. Clubwerk works out by itself whether you are arriving or leaving and shows “Hello” or “Goodbye” with the time. When leaving, it also shows today’s hours; it always shows the month’s hours so far.

Good to know:

- **Clocked in by mistake?** Anyone who taps again within one minute reverses the clock-in (“Reversed”). No entry is kept.
- **Forgot to clock out?** After 12 hours the shift counts as forgotten. The tile turns red (“forgotten”). The next time the person clocks in, a new shift starts, and the tablet says the board should add the end of the last one. You then add it in the admin area (see “Edit”).
- **Wrong PIN:** after several failed attempts the person is locked out briefly (one hour at most); after many failed attempts from one device, the device is locked as well. Both appear in the log, and if it repeats, the admin area shows a security notice.
- The success message closes by itself after 12 seconds, an open PIN window after one minute.

There is no member app page for time tracking: staff clock in only at the tablet.

## Permissions {#rechte}

| Permission | What it allows |
|---|---|
| Time tracking | See hours, add, change and delete shifts, manage staff and PINs, see hourly rates, download the monthly report as PDF and Excel, set the recipient and sending |

Clocking in at the tablet needs no permission, only the name and your own PIN. The tablet itself is protected by the tablet password.

## Working with other modules {#zusammenspiel}

- **Overview:** the start page of the admin area shows how many people have been added and who is here now, and warns if someone has been clocked in for more than 12 hours, if sending failed or if no mailbox is set up.
- **Mailbox (Settings):** the monthly report is sent through the shared club mailbox.
- **Backup:** the backup includes the working times of the current month as an Excel file.
- **Data protection:** the module appears in the record of processing activities (Settings › Data protection): working-time records at least 2 years, payroll documents 6 years. They are not deleted automatically.
- **Setup assistant:** contains the steps “Staff” and “Monthly report”.
- **Duties & events:** the voluntary hours of members are handled there, separately from this time tracking.
