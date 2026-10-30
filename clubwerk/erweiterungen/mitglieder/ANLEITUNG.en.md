# Members
<!-- kurz: Master data, families, fees, direct-debit collection and reminders – the club's membership management. -->

## What is this module for? {#wofuer}

Everything the club knows about its members is kept here: name, address, departments, fee, bank details and SEPA mandate, families, honours and positions. From this the module bills the fees, collects them by SEPA direct debit, writes invoices and reminders and handles membership applications digitally. Members see and change their own details in the member app (“My data”).

In the sidebar the module has **two menu items**: **Members** (members, applications, congratulations, fees & departments, statistics, settings) and **Fees & payments** (fee run, direct debits, open items, invoices & reminders, bank statement, settings).

All other modules work with the same people. Without this module there are only first and last names everywhere; fees, families and direct debits do not exist then.

## Setting up {#einrichten}

1. **Settings › Modules:** switch “Members” on. With “Demo” you can try the module with made-up data first.
2. **Give permissions:** under Settings › Users & permissions, give everyone who should help the matching permissions (see the “Permissions” section). For department heads, a role has the tick box “Own department(s) only”.
3. **Create fees and departments:** “Fees & departments” tab. There are deliberately no templates, because every club calculates differently.
4. **Club account and direct debit:** enter the account under Settings › Bank accounts, and the creditor ID and mandate reference under “Fees & payments › Settings”.
5. **Bring in members:** with “Import …” from your previous system, or one by one with “+ New member”.

> The “Setup” item in the sidebar walks you step by step through fees, club account, direct debit, membership and import, and ticks off what is done.

## Admin area {#verwaltung}

### “Members” tab {#mitglieder}

![The member list, here filtered on “Hofmann”: tabs at the top, buttons on the right, warning box, filters and the list.](bild: seite=mitglieder; fuelle=#mvQ::Hofmann)

The page shows all members as a list, sorted by last name and first name. The columns:

- **Name** (“Last name, first name”), below it the leaving date for anyone who is leaving, or the status for passive, dormant and honorary members.
- **No.** (the member number), **Age** and **Departments**.
- **Fee:** the fee type. For family members it says “Family” with the name of the head of the family.
- **Payment:** direct debit, invoice or cash. If somebody else pays, it says “via name”. A “+3” shows how many relatives this person also pays for.
- **Notes:** yellow marks where something is missing or needs checking, e.g. “Check age bracket” or “Revoke mandate”.

At the top you see a **red warning box** if members are missing required details (member data, fee, bank details or SEPA mandate). “Show” jumps to the “With note” filter. Anyone missing required details is missing from the fee run.

For searching and filtering there are:

- the **search** by name, number, email or town,
- the **filters** “Current”, “With note”, “Left” and “All” (each with its count) plus a selection field each for **department** and **fee**.

Clicking a row opens the member. “← All members” takes you back, with the filters you last set.

#### + New member

![The “New member” window.](bild: seite=mitglieder; klick=#mvNew; ziel=dialog)

A member is only created **completely**: name, date of birth, joining date, address, email, mobile, fee, department and payment method. For direct debit, the account holder (Clubwerk suggests the name), IBAN and the date of the SEPA mandate are needed as well. On top comes the **signed membership application** as a PDF or photo (choose the file or drag it into the box).

- Clubwerk assigns the **member number** itself if the field stays empty.
- For the **fee** only the types that fit the age can be chosen; the rest are greyed out. Enter the date of birth first.
- If “Direct debit is required” is set in the settings, direct debit is the only payment method.
- If the new member is to sign on the tablet, use “+ Membership application” on the “Applications” tab instead.

#### Import …

![The import window: choose the file first.](bild: seite=mitglieder; klick=#mvImp; ziel=dialog)

The import takes over members from **S-Verein/SPG-Verein**, **WISO Mein Verein**, **verein.cloud** or your own list (CSV, TXT or Excel). It runs in three steps:

1. **Choose the file.** Clubwerk recognises the program from the column headings and suggests which column goes where. On the right, the values of one person are shown as an example. Where the suggestion is wrong, set the column yourself. At the bottom you enter up to when the fees were already billed in the old program (“Fees billed so far until”) and whether the SEPA mandates have already been used. That way the next fee run does not bill anything twice.
2. **Preview.** Tiles show how many people are created or updated. Below that you check what Clubwerk cannot decide on its own. For departments and fee types with “similar names” you must choose.
3. **Apply.** Clubwerk recognises existing people (also those from sales) by number or name and updates them; PINs are kept. Payers and families are linked. “Back to mapping” goes back one step at any time.

The preview has four check cards:

- **Similar names already on file** (e.g. “Benni” and “Benedikt”): merge them or create a new member.
- **Departments from the file:** assign an existing one, create a new one or do not take it over.
- **Fee types from the file:** the same. “Do not take over” means the member comes without this fee. There is also “merge with …” (see below).
- **Field check with an example:** this is how the columns of one person end up in Clubwerk.

**Merging fee types.** If the old program keeps the same fee type under several names (e.g. “Youth up to 18” and “Juniors up to 18”), choose “merge with “…”” for one of them. The chosen one is the target: it is created, under a new name if you like (“create as”), or you assign it to an existing fee type. All members of the merged types end up in the target type, each exactly once.

- If fee types look the same (same amount, frequency and department, similar name), Clubwerk suggests merging them: a blue note appears at the top, the group is framed in colour and marked “similar”.
- The amount, frequency, age limits, family setting and department of the target apply. If anything differs, a yellow warning box states who will pay how much in future. Nothing is imported without ticking “Understood – import like this”.
- Chains are allowed (A with B, B with C), loops are not.
- The “Result” line shows before importing which fee types will be created and with how many members.

#### Excel

![The “Member list as Excel” window with the columns to choose from.](bild: seite=mitglieder; klick=#mvXls; ziel=dialog)

Downloads the list as an Excel file with the columns you tick. The filter of the list applies (e.g. only one department).

### Opening a member {#mitglied}

![An opened member: name and key facts at the top, below them “← All members” and the tabs.](bild: seite=mitglieder/mitglied/7; tab=stamm; tabkey=detail_mitglied; ziel=.detailrow)

Above the tabs is the name; below it a line with number, age, status, planned leaving date, “pays via …” or “Family of …” and a note if change requests from the app are waiting. The tabs are **Master data**, **Membership**, **Payment & family**, **Account & mandate**, **Documents** and **History**. Anyone who looks after just one department only sees “Master data”, “Membership”, “Documents” and “History”.

If required details are missing, a red box appears at the top. For a person who is not a club member at all (for example a coach), the button **Convert to “Not a member” …** converts them. Their account stays in sales; they no longer appear in the member list.

### Member › Master data {#mitglied-stamm}

The first tab has three cards and one common “Save” button below them.

#### Person

![The “Person” card.](bild: seite=mitglieder/mitglied/7; tab=stamm; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(1))

Salutation, title, first name, last name, date of birth, gender (male or female), member number and **status**: active, passive/supporting, honorary member or dormant.

#### Address & contact

![The “Address & contact” card.](bild: seite=mitglieder/mitglied/7; tab=stamm; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(2))

Street, postcode, town, address line 2, country, email, mobile, phone and the **letter salutation** (e.g. “Dear Anna”). Also the joining date, the key number and **notes** that only the board sees.

#### Consents

![The “Consents” card.](bild: seite=mitglieder/mitglied/7; tab=stamm; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(3))

One tick box per consent with its date (“since …”), e.g. for photos. Which ones exist is set under “Settings”.

#### More cards and buttons

- **Tablet PIN:** shows whether the member has a PIN. “Reset PIN” deletes it; next time the member sets a new one on the tablet.
- **Profile picture:** appears when the member has uploaded one in the app. “Remove profile picture …” deletes it.
- **Caution:** “Delete …” only works if nothing is attached to the member any more (meant for members created by mistake or twice). “Anonymize …” only exists after leaving. It permanently deletes name, address, account, documents and history; for the statistics, birth year, gender, joining and leaving and departments remain. For safety you type the word ANONYMISIEREN.
- **Data access request** (button on the right of the tab bar): downloads a file with everything Clubwerk has stored about the person, including data from other modules. Without the “Bank details” permission the IBAN in it is masked.

### Member › Membership {#mitglied-mitgliedschaft}

The tab has four cards: Fees, Departments, Honours and Positions & roles.

#### Fees

![A member's “Fees” card.](bild: seite=mitglieder/mitglied/24; tab=mitgliedschaft; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(1))

Which fee types the member has, with amount, frequency, “from”, “to” and **billed until**. If a fee type does not (or no longer) fit the age, it says “does not match age”. “+ Fee” assigns another type, “Edit” changes one:

![The “Assign fee” window.](bild: seite=mitglieder/mitglied/24; tab=mitgliedschaft; tabkey=detail_mitglied; klick=#fAdd; ziel=dialog)

- **From / To:** start and end (empty = no end date).
- **Different amount:** applies instead of the amount of the fee type, e.g. for a reduction.
- **Billed until:** set by the fee run itself. Only change it if you billed outside Clubwerk.
- **Remove fee …:** only sensible as long as nothing has been billed. Otherwise enter an end date.

If the member is a family member, they have no fee of their own; it is part of the head of the family's family fee.

#### Departments

![A member's “Departments” card.](bild: seite=mitglieder/mitglied/24; tab=mitgliedschaft; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(2))

For each department you see status, joining, leaving and the **add-on fee** (by age, “fixed” or “exempt”). “+ Department” and “Edit” open the window for it:

![The “Assign department” window.](bild: seite=mitglieder/mitglied/24; tab=mitgliedschaft; tabkey=detail_mitglied; klick=#dAdd; ziel=dialog)

The add-on fee normally follows the age automatically. But you can set it to a fixed fee type or **exempt** the member (e.g. a coach). Someone who leaves the department is better given a leaving date than removed. Then the statistics are right.

If someone moves into another fee type because of their age, a yellow **age bracket note** with “Keep as is” and “Switch” appears at the top of the tab. Until you decide, the current fee continues.

#### Honours and Positions & roles

![The “Honours” and “Positions & roles” cards.](bild: seite=mitglieder/mitglied/24; tab=mitgliedschaft; tabkey=detail_mitglied; ziel=.detbody > .mv-two)

Two cards side by side. With “+ Honour” and “+ Position” you enter a name and date, “Remove” deletes the entry. Positions (e.g. treasurer) are also available to other modules, for example for permissions when booking courts. Under “Honours” there is also the tick box **No congratulations wanted** (see the “Congratulations” tab).

#### Leaving

![The “Leaving” window.](bild: seite=mitglieder/mitglied/24; tab=mitgliedschaft; tabkey=detail_mitglied; klick=#mvExit; ziel=dialog)

The **Leaving …** button on the right of the tab bar records the leaving: date (the end of the fee year is suggested), date the cancellation was received, reason and, if you like, the cancellation letter as a file. You decide whether fees and departments end at the leaving date and whether relatives leave too. Until the leaving date everything stays as before. After that the member disappears from the tablet and the app; the data stays until anonymised. A leaving that has not yet taken effect can be withdrawn with **Revert leaving**, one that has been completed with **Rejoin …** (the member gets a new number and needs a new mandate for direct debit).

### Member › Payment & family {#mitglied-zahlung}

There are two **separate** assignments here, side by side in two cards.

#### Who pays?

![The “Who pays?” card with the payer group.](bild: seite=mitglieder/mitglied/7; tab=zahlung; tabkey=detail_mitglied; ziel=.detbody > .mv-two > div:nth-child(1))

This is purely a money relationship: fees, add-on fees and sales run through the account and mandate of the **payer**. It can also be a father paying for his adult child. Below it is the payer group. Under “Sales on the tablet” you set whether a relative books on the tablet via the main payer or has their own entry. The **payment method** (direct debit, invoice, cash) applies to the payer.

#### Family membership

![The “Family membership” card.](bild: seite=mitglieder/mitglied/7; tab=zahlung; tabkey=detail_mitglied; ziel=.detbody > .mv-two > div:nth-child(2))

A **head of family** with a family fee covers partner and children. One partner and any number of children up to 18 are allowed (adjustable). Anyone assigned needs no fee type of their own; department add-on fees stay per person. On the head of family you add relatives via “Add relative …”; “Remove” takes them out again. On a relative you choose the head of family under “Family membership with”.

#### Claims & payments

![A payer's “Claims & payments” card.](bild: seite=mitglieder/mitglied/7; tab=zahlung; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(2))

All items of the payer (columns Position, Due, Type, Status, Amount). “Paid”, “Change” and “Cancel” work here as under “Open items” (see there). “+ Charge” on the tab bar creates a new item, “Invoice (PDF)” prints the open items as an invoice.

#### Reminders

![A payer's “Reminders” card with the reminder history.](bild: seite=mitglieder/mitglied/11; tab=zahlung; tabkey=detail_mitglied; ziel=.detbody > .card:last-child)

The reminder letters so far (date, letter, amount, fee). “Reminder hold …” stops reminders for all items of this payer (with a reason and an optional date, e.g. for an agreed payment plan). After two returned debits a note says the payer is no longer collected from; “Collect again …” cancels that.

### Member › Account & mandate {#mitglied-konto}

![The “Bank account” and “SEPA direct debit mandate” cards.](bild: seite=mitglieder/mitglied/7; tab=konto; tabkey=detail_mitglied)

At the top is the **bank account** (account holder, IBAN with check, BIC, bank), next to it the badge “Mandate valid” or the reason why not. The **SEPA direct debit mandate** card has the mandate reference, date of signature and “last used”.

- Never used means: the next direct debit is a **first-time debit**. For a mandate from the previous system you enter “last used”, then it is a recurring debit.
- A mandate reference that has been used once cannot be changed any more (the bank knows it). For a new bank account or a newly signed form use **New mandate …**.
- **Revoke mandate** blocks direct debits from this account; “Undo revocation” takes it back.
- A mandate **expires** if it has not been used for 36 months.

For family members and members with a different payer the tab is greyed out: account and mandate belong to the head of family or payer. Without the “Bank details” permission the IBAN is masked.

### Member › Documents {#mitglied-dokumente}

![The “Documents” tab: file document and the filing.](bild: seite=mitglieder/mitglied/7; tab=dokumente; tabkey=detail_mitglied)

Membership application, SEPA mandate, cancellation, proofs and correspondence are kept here as files. With **File document** you choose the type, optionally a name, and the file (PDF, photo, Word or text, up to 15 MB). In the **Filing**, “Open …” opens the file or deletes it. The documents are stored only on the club computer and are included in the backup. For family members the membership application and mandate are with the head of family.

### Member › History {#mitglied-verlauf}

![The “Change history” card.](bild: seite=mitglieder/mitglied/7; tab=verlauf; tabkey=detail_mitglied; ziel=.detbody > div:nth-child(2))

At the top it says whether a phone is authorised for the member app (and when it was last used). Below is the **change history**: every changed field with time, before, after and who changed it.

### “Applications” tab {#mv-antraege}

![The “Applications” tab with a new membership application and two change requests.](bild: seite=mv-antraege)

Membership applications and change requests arrive here. The number on the tab shows how many are waiting for you. The buttons at the top right:

- **Form (PDF):** the empty paper form to print.
- **Online application …:** switches the application on via the address of the member app and shows the link to copy (it ends in `/p/mitglieder/`). A trap for automatic forms, a minimum filling-in time and a limit per device and day protect against misuse.
- **+ Membership application:** you enter the data, and the new member signs on the tablet with a code.

#### Enter membership application

![The “Enter membership application” window.](bild: seite=mv-antraege; klick=#aNew; ziel=dialog)

You enter people, address, membership and SEPA mandate. For a **family**, add partner and children with “+ Person (family)”; then the family fee applies and the applicant becomes main payer. At the end there is “Generate code for the tablet” (the code is valid for three hours). On the tablet the new member taps “Join” › “I have a code”, checks their data, ticks the consents and signs the membership application and the SEPA mandate. With the tick box “Accept as member immediately after signing” they are created right away afterwards and get a welcome email with member number and mandate reference.

#### Awaiting confirmation

Signed applications (from the tablet or online) wait here. “Review & accept” opens them:

![The membership application to review: people, match with existing members and fee.](bild: seite=mv-antraege; klick=[data-ap]; ziel=#dialog .split table)

For each person Clubwerk suggests whether they are **created new** or **merged** with an existing member (e.g. if someone is already known in sales), and which fee applies. On the right of the window is the signed application as a PDF with a check value. “Accept & create members” creates everything; “Reject” rejects it (with an internal reason). A department head can only endorse an application; the club administration then has to accept it.

#### Awaiting signature on tablet

Applications with a code that have not been signed yet. “New code” creates a fresh one (it expires after three hours), “View” shows the application, and in the window “Delete application …” deletes it.

#### Changes & Reports

Requests from the member app and reports from department heads:

- **Data change** (e.g. new address): “Apply” shows old and new for confirmation, “Reject” sends the member an email with the reason if you want.
- **New bank details:** with the member's signature. On applying, a new mandate is created (first-time debit); the signed mandate is filed as a PDF and sent to the member.
- **Cancellation:** Clubwerk suggests the earliest possible leaving date based on notice period and fee year, you confirm or change it. The member gets a confirmation by email.
- **Joining, leaving and return to a department** are reported by the department head; “Confirm” applies them.

#### Archive

“Show all applications” also lists accepted and rejected applications.

### “Congratulations” tab {#mv-gratulationen}

![The “Congratulations” tab: upcoming occasions and your own reminder.](bild: seite=mv-gratulationen)

A list of the birthdays and anniversaries of the next 30 days: name, date, occasion, planned congratulation (e.g. “Flowers”), who takes care of it and the status (“today”, “past”, “done”). “Open” and “All” filter. The tab only appears with the “Congratulations” permission.

#### Editing an occasion

![The “Congratulations” window for editing.](bild: seite=mv-gratulationen; klick=[data-cg]; ziel=dialog)

“Edit” opens the occasion. You enter **who takes care of it** and a note, and tick **Done**. For anniversaries, the tick box “Add to the member as an honour” saves the honour in the member right away. “No congratulations wanted …” removes the person from all occasions (undo on the member). Occasions you created yourself can be deleted.

#### + Occasion

![The “Add occasion” window.](bild: seite=mv-gratulationen; klick=#cgNew; ziel=dialog)

For occasions no rule knows, such as a golden wedding: member, date, occasion and congratulation.

#### Your reminder

Everyone with the “Congratulations” permission chooses for themselves whether to get an **email** or a **push message** in the member app a few days before each occasion (once per occasion). For this, your user account must be linked to your own member under Users & permissions. The rules themselves are under “Settings”.

### “Fees & departments” tab {#mv-stamm}

This page is the club's price list. At the top right are the buttons **+ Department**, **+ Add-on fee** and **+ Fee type**. The number on the tab shows how many members are currently changing age bracket.

#### Main club fees

![The fee types of the main club.](bild: seite=mv-stamm; ziel=#cBody > div:nth-child(1))

For each fee type: name, amount, frequency (yearly, half-yearly, quarterly, monthly, one-off) with the rule for the joining year, age limits, whether it is a **family fee**, work hours, whether it is on the membership application, and the number of members. With ↑ and ↓ you set the order; that is also the order in selection fields and on the form.

![The “New fee type” window.](bild: seite=mv-stamm; klick=#fNew; ziel=dialog)

The fields in the window:

- **Type:** “Main club fee” or “Department add-on fee”.
- **Name** (as on the form) and **Amount**.
- **Frequency:** yearly to monthly or “one-off”, e.g. for an admission fee.
- **In joining year:** “pro rata (full months)”, “full amount” or “Joining year free”.
- **Work hours per year:** empty = default of the “Duties & dates” module, 0 = none.
- **Minimum age** and **Maximum age:** a note in the fee run and a suggestion for new applications.
- **Family fee:** applies to the main payer and all relatives.
- **Offered for selection on the membership application:** only these types are offered to new members on the tablet and online.
- **Active** and **Note (internal)**. “Delete fee type …” only exists if no member has it any more. A type that has already been billed is better deactivated.

#### Department add-on fees

![The department add-on fees.](bild: seite=mv-stamm; ziel=#cBody > div:nth-child(2))

Every person who belongs to the department pays an add-on fee on top of the main club fee, namely the amount for **their age**. For this you create several fees per department with age limits (e.g. “Tennis Jugend” up to 17 and “Tennis Erwachsene” from 18). In families the main payer pays the add-on fee only for the relatives who are in the department.

#### Departments

![The departments.](bild: seite=mv-stamm; ziel=#cBody > div:nth-child(3))

Name, federation and number of members. “+ Department” creates a new one (name, federation, order); inactive departments are no longer offered for selection, empty ones can be deleted.

#### Age brackets

![The “Age brackets” card with two suggestions.](bild: seite=mv-stamm; ziel=#cAges)

Anyone who gets older and no longer fits their fee, grows out of the family fee or moves into a higher level of the add-on fee is listed here with the occasion, current and new fee and date. **Switch** moves to the new fee from the next period, **Keep as is** remembers the decision. Until then the current fee continues.

### “Statistics” tab {#mv-auswertung}

Figures for the board and the federations. The **Reference date** field at the top sets the day the figures apply to.

#### Tiles, departments, joinings and leavings

![Members on the reference date, average age and gender.](bild: seite=mv-auswertung; ziel=#mvBody > div:nth-child(2))

![Departments and joinings and leavings per year.](bild: seite=mv-auswertung; ziel=#mvBody > .mv-two)

- **Tiles:** members on the reference date, average age and gender.
- **Departments:** members per department.
- **Joinings and leavings:** per year with balance, plus “Leaving announced”.

#### Membership census (state sports federation)

![The membership census for the state sports federation.](bild: seite=mv-auswertung; ziel=#mvBody > div:nth-child(4))

The table by age group and gender, as the state sports federation requires it. “Excel as of 01.01.…” downloads it as a file. Clubwerk does not count members without a date of birth and points that out.

#### Milestone birthdays & anniversaries

![Milestone birthdays and anniversaries of the next twelve months.](bild: seite=mv-auswertung; ziel=#mvBody > div:nth-child(5))

The occasions of the next twelve months with date and years. The planning for them is on the “Congratulations” tab.

#### Consents

![How many members have agreed to the consents.](bild: seite=mv-auswertung; ziel=#mvBody > div:nth-child(6))

Shows for each consent (e.g. photos) how many members have agreed and how many have not. “List (Excel)” downloads the names, e.g. for the press officer.

### “Settings” tab {#mv-einstellungen}

The cards are stacked; each has its own “Save”.

#### Membership

![The “Membership” card.](bild: seite=mv-einstellungen; ziel=[data-set="mitgliedschaft"])

- **Member numbers from:** the first number assigned automatically.
- **Fee year starts on the 1st:** the month your fee year begins.
- **Notice period (months):** the basis for the earliest leaving date.
- **Direct debit is required:** new members then need bank details and a SEPA mandate; “invoice” and “cash” can no longer be chosen. Family members and anyone paying via a payer are exempt. Existing members with another payment method appear under “With note”.
- **Joining and leaving reported by department heads is confirmed by the club admin:** if a department head reports a new member, a leaving or a return, it lands under “Applications” and only counts after confirmation by an admin.

#### Membership application & online application

![The “Membership application & online application” card.](bild: seite=mv-einstellungen; ziel=[data-set="antrag"])

Here you switch on where people can join: **on the tablet** (“Join”) and **online** via the address of the member app. In addition:

- **Greeting** at the top of the form, **Note on fee & due date**, **Work assignment note** and a **link to the statutes**.
- **Consents:** per line a short name, the text on the form and “Required”. “+ Consent” adds one; “+ Template …” offers common texts (photos, press & notice board, birthday in the club magazine) to adapt. Changes only apply after “Save”.

![The templates for consents.](bild: seite=mv-einstellungen; klick=#eConsTpl; ziel=dialog)

#### “My data” in the app

![The “My data” card in the app.](bild: seite=mv-einstellungen; ziel=#eApp)

Sets what members can **view** in the app (fee, items, address, contact, date of birth, bank details, consents) and what they may **change** (address, contact, bank details, consents, cancellation). The board always confirms changes to data. If the consents are hidden in the app, members withdraw them informally with the board.

#### Notifications

![The “Notifications” card.](bild: seite=mv-einstellungen; ziel=[data-set="benachrichtigung"])

The email addresses (separated by commas) that are told about new applications and app changes.

#### Congratulations

![The “Congratulations” card with the rules.](bild: seite=mv-einstellungen; ziel=#eCg)

The rules: per line the **Occasion** (birthday, club anniversary, department anniversary), **When** in years (“70, 75, from 80” means: at 70, 75 and every year from 80) and **What** (e.g. “Flowers”). Below that you set how many days before to remind and see who is reminded.

#### Data protection & retention

![The “Data protection & retention” card.](bild: seite=mv-einstellungen; ziel=[data-set="daten"])

After leaving, the club usually needs name and address only for a short time. With **Remind after … years** Clubwerk reports members who have been gone that long and offers **View list …**. There you can **anonymise** everyone without an open claim at once (type ANONYMISIEREN to confirm). Amounts and bookings stay for the statutory retention (receipts 8 years, books 10 years).

#### Transfer settings

Exports settings, fee types and departments as a file and reads them into another Clubwerk installation (without members).

### “Fees & payments” menu {#zahlungen}

This second menu item belongs to the module and only appears with the “Collection” permission. At the top of every page are **four tiles**:

![The tiles: open, of which overdue, in collection and received in the current year.](bild: seite=mv-beitraege; ziel=.kpis)

**Open** (all unpaid items), **of which overdue**, **in collection** (in a submitted direct debit) and **received** in the current year. The usual way: fee run, create the direct debit and submit it to the bank, book the payment, send reminders if needed.

### “Fee run” tab {#mv-beitraege}

![The “Fee run” card with the preview below it.](bild: seite=mv-beitraege; klick=#rPrev; ziel=#fBody)

The fee run creates the fees as **open items**: for all members, pro rata from joining, each period only once. You choose:

- **Bill until:** the reference date (today is suggested).
- **Payment method only:** all, or only direct debit, invoice or cash.
- **Also debit sales:** includes the members' open sales accounts (only with the Sales module).
- **Include unworked work hours in billing:** only with the “Duties & dates” module.

**Preview** shows what would be created: for each payer the positions with type, due date and amount, total and warnings (e.g. missing details). With the tick boxes you take single positions out. **Bill fees** creates the items. After that “Continue to collection” leads to the direct debits; whoever pays by invoice or cash gets their invoice under “Invoices & reminders”.

#### Previous runs

Each run is listed with date, type, reference date, number of positions and total. “Items” shows the items of the run. As long as none of them has been collected, **Undo run …** reverses it (the sales accounts are then open again too).

### “Direct debits” tab {#mv-einzug}

#### New collection

![The “New collection” card after “Check”.](bild: seite=mv-einzug; klick=#kPrev; ziel=#fBody > div:nth-child(1))

A collection combines the due items of each payer into **one direct debit**. Clubwerk separates first-time and recurring debits itself. You choose the **collection day**; the earliest day that respects the pre-notification period is suggested (a later one always works). **Check** shows what will be collected: payer, account, mandate, type (First/Recurring), items and amount. Tick boxes take single payers out. Red and yellow notes say what does not work: not a banking day, too early, payer without a valid mandate, items only due after the collection day. Payers with invoice or cash do not appear here. **Create collection** creates the collection and opens it.

#### Collections

![The list of collections.](bild: seite=mv-einzug; ziel=#fBody > div:nth-child(3))

The list shows date, status (created, booked, discarded), number of direct debits, total and whether the pre-notification has gone out. **Details** opens the collection:

- **Download SEPA file:** you upload the file (pain.008.001.08) in online banking under “Bulk direct debit / upload SEPA file”.
- **Pre-notification by email:** sends each payer amount, date, mandate reference and creditor ID. Anyone without an email gets a printable PDF via **Letters for members without email**.
- **Returned debit:** you record it per payer with a reason, a fee to pass on and, if you like, blocking the mandate right away. The items become open again, the fee is added as an item. After two returned debits the payer is no longer collected from; they then pay by bank transfer and get reminders.
- **Payment received:** books all direct debits without a returned debit as paid. Only do this when nothing more comes back (usually after 1–2 weeks). Clubwerk reminds you on the overview.
- **Discard:** only if the file was **not** submitted to the bank. The items become open again, and if you want the run is undone too.

Below that are the payers of the collection (name, email, items, amount) with the **Returned debit** button:

![The “Record returned debit” window.](bild: seite=mv-einzug; klick=[data-kopen]; klick2=[data-ret]; ziel=dialog)

#### Collect sales

![The “Collect sales” card.](bild: seite=mv-einzug; ziel=#fBody > div:nth-child(2))

Only with the Sales module. Collects the members' open sales accounts separately from the fees, at any time and in one flow up to the SEPA file. The window shows who pays by direct debit and who does not (with the reason and what you can do, e.g. collect cash). The accounts count as billed afterwards. The same route exists in Sales under “Billing”.

### “Open items” tab {#mv-posten}

![The filters “Open”, “Overdue”, “In collection”, “Paid” and “All” above the list.](bild: seite=mv-posten; klick=[data-f="ueber"]; ziel=.filterbar)

All claims and credits of the members with their status. At the top the chips **Open**, **Overdue**, **In collection**, **Paid** and **All** filter; on the right are the count and total. In the list: payer, position, due date, type (fee, sales, work hours, admission, returned debit, reminder fee, other), status and amount. A red status names the dunning level; “Reminder hold” shows a hold. The same list is on the payer's “Payment & family” tab (“Claims & payments” card).

![The “Record payment” window.](bild: seite=mv-posten; klick=[data-f="ueber"]; klick2=[data-cpay]; ziel=dialog)

- **Paid:** records a payment with amount, date and payment method (bank transfer, cash, direct debit, offset). If somebody pays less, it is a **part payment** and the rest stays open.
- **Change:** change text, amount and due date; also **Cancel item …** and the **reminder hold** for this item.
- **Cancel** (for paid items): with a reason. For a fee you can have the period billed again in the next fee run. If the money arrived according to the bank statement, you choose whether it stays as a credit or was transferred back.
- **+ Charge** (top right) creates a new item:

![The “Create claim” window.](bild: seite=mv-posten; klick=#cNew; ziel=dialog)

You choose the member and enter text, amount (with a minus sign for a credit), due date and type. For relatives the claim lands with the payer. Better book sales amounts to the account in Sales under “Billing”.

The **In collection** filter shows items in a submitted direct debit. There you tick them and book **Payment received** with the date of the credit. The bank statement matches incoming payments to the items (see the core guide).

### “Invoices & reminders” tab {#mv-mahnung}

![Invoices and reminders: who is due now.](bild: seite=mv-mahnung; ziel=#fBody)

The tab has four parts. At the top a box warns if the last bank statement is older than 7 days or bookings have not yet been matched to an item. Then read in the bank statement first, otherwise someone who has already paid gets a reminder.

#### Invoices

For payers with **invoice or cash** (and payers who are no longer collected from after two returned debits). Each payer shows number of items and amount in the list. “PDF” shows the invoice, **Send selected by email** sends it with the PDF.

#### Reminders – due now

The reminder run: Clubwerk shows who gets a letter now, with the **level per item** (e.g. payment reminder, 1st reminder, 2nd reminder), due date, number of items, open amount and fee. You keep the tick boxes and choose:

- **Send emails:** the letter goes as a PDF to everyone with an email address.
- **Letters as PDF:** one combined PDF for everyone without email. Afterwards Clubwerk asks whether the letters have been printed.

Only after sending (or after “Letters printed”) does Clubwerk book level and fee. If something changed in the meantime (e.g. a payment), that payer is skipped and named. Payers with a direct debit mandate are not sent reminders; their items go into the next collection.

#### Final reminder without payment

Whoever has reached the last level and whose deadline has passed is listed here. What happens then is for the board to decide; “Open” jumps to the member.

#### Reminder holds

All holds that are set with reason and date. “Lift” takes a hold back. They are set on the payer (“Payment & family” tab) or on a single item.

### “Bank statement” tab {#mv-kontoauszug}

The bank statement reads in the bank transactions and matches them to the open items, including returned debits. It belongs to the core of Clubwerk; its guide is there. Here the reminders and the items show whether the bank statement is up to date.

### “Settings” tab (Fees & payments) {#mv-zeinst}

#### Direct debit (SEPA)

![The “Direct debit (SEPA)” card.](bild: seite=mv-zeinst; ziel=[data-set="sepa"])

- **Name as payee** and the **club address** (you change it under Settings › Club).
- **Creditor ID:** the club gets it from the Bundesbank.
- **Mandate reference = prefix + no.:** the prefix is the start of every mandate reference; the member number follows.
- **Pre-notification (days before):** how early you announce the direct debit. The earliest collection day depends on it.
- **Direct debit account:** one of the club accounts (Settings › Bank accounts); otherwise the default account.
- **Sales collection usually on:** day and month for collecting the sales accounts.
- **Returned debit fee:** the amount you pass on for a returned debit.

If the BIC is missing on the club account, Clubwerk points it out: that is allowed, but some banks require it.

#### Invoices

![The “Invoices” card.](bild: seite=mv-zeinst; ziel=[data-set="rechnung"])

An **additional text** appears on invoices and reminders, e.g. tax number or club register.

#### Reminders

![One reminder stage with name, days, fee and text.](bild: seite=mv-zeinst; ziel=#eLv > div:nth-child(1))

The **payment deadline** in the letters (days) and up to five **reminder stages**. For each stage: **Name**, **Days** (the first comes that many days after the due date, each further one that many days after the previous), **Fee** (charged once per letter) and the **text**. In the text Clubwerk replaces `{name}`, `{betrag}` (total open) and `{frist}`. “+ Stage” adds one, “Remove last stage” deletes the last one.

#### Transfer settings

As on the “Settings” tab under “Members”: save the settings as a file or read them into another installation.

## Tablet and app {#tablet-app}

![“My data” in the member app.](bild: app=mitglieder)

![The “Join” tab on the tablet.](bild: tablet=Join; hoehe=430)

**In the app** (“My data”) every member sees their membership with fees and departments, the family, their payments with status (open, being debited, paid), address, contact and bank details. What is visible and what may be changed is set under “Settings”. The member can:

- **Change contact details.** The board confirms the change. A new email address is confirmed by the member with their PIN.
- **Give new bank details** on the phone with a signature as a new SEPA mandate. The board applies it.
- **Give or withdraw consents** (takes effect at once, with PIN).
- **Request the data access:** it arrives as a PDF by email.
- **Cancel**, if allowed. The app names the earliest leaving date; families choose who cancels too.

Signatures, cancellation and changes that concern money or email require the member's PIN.

![The “New bank details” window with the signature field.](bild: app=mitglieder; klick=#mdBank)

**On the tablet** the “Join” tab appears if it is switched on. Interested people fill in the membership application themselves and sign with a finger, or enter the **code** from the admin area. For privacy reasons the tablet deletes everything after 4 minutes without input and 25 seconds after sending. Anyone who is already a member books on the tablet with their PIN as before; the PIN is reset by the admin area on the member.

**Online:** via the address of the member app (`/p/mitglieder/`) there is the same application for the phone, if “Online application” is switched on.

## Permissions {#rechte}

| Permission | What it allows |
|---|---|
| Members | See and change members, handle applications and change requests, plus fees & departments, statistics, settings, import, Excel, data access request, delete and anonymise |
| Tick box “Own department(s) only” (in the role) | Addition to “Members” for department heads: only their own department, only the “Members” and “Applications” tabs, on the member no “Payment & family” and “Account & mandate”, no import and Excel |
| Bank details | See and change bank details and SEPA mandate in full (otherwise the IBAN is masked) |
| Collection | “Fees & payments” menu: fee run, direct debits, open items, invoices & reminders, settings, claims, reminder holds |
| Documents | “Documents” tab on the member: view and upload |
| Congratulations | “Congratulations” tab, ticking off and reminders |

## Working with other modules {#zusammenspiel}

- **Sales:** The members are the people in sales. With this module the account list (“Accounts & PINs”) is in Sales. The fee run can also debit sales accounts, “Collect sales” collects them by direct debit, and the item type “Sales” exists then. Someone who pays via a payer books on the tablet in the payer's name. Without the Sales module these choices disappear.
- **Duties & dates:** The fee run bills unworked work hours; the hours per fee type are set on the fee type.
- **Accounting:** Invoices to members appear here as an open item (payable by direct debit or bank transfer). When the item is paid or cancelled, Accounting takes over the status.
- **Courts:** Fees for courts and guests become claims and are collected like a fee. Positions from this module can determine permissions when booking courts.
- **Match play:** Birth year and gender come from here (for age groups).
- **Messages:** Recipients can be chosen by department, position or fee type.
- **Member app:** “My data” and the online application.
- **Bank statement and bank accounts (core):** Imported bank statements book items as paid and record returned debits. You choose the account for direct debits from the bank accounts.
- **Privacy (core):** The data access request collects the data of all modules. Anonymised members stay in the statistics, bookings continue under “Anonymous …”.
- **Setup and overview (core):** Setup guides you through the first steps. The overview warns about new applications, missing mandates, upcoming age brackets, members who left long ago and direct debits still to be booked as paid.
