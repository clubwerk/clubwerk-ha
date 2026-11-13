# Accounting
<!-- kurz: Invoices, donation receipts, expenses with receipts, cash book and income statement. -->

## What is the module for? {#wofuer}

Accounting writes invoices to sponsors, companies and members, keeps track of what has been paid, and reminds people by email about overdue amounts. It also issues donation receipts (donation acknowledgements) in the official format: for cash donations, donations in kind and waived expense reimbursement. You set up each sponsor once, with their annual items (for example perimeter advertising). The annual invoices are then created with one click.

The treasurer also records everything that costs money here: **expenses with a receipt** (photo or PDF), from the bank account or a cash box. The **cash book** shows per cash box what went in and out in cash, with cash count and monthly locking. The **Income statement** tab shows income and expenses per sphere (cash basis).

The module works on its own. Without Members, invoices and donation receipts go only to companies and one-time donors, and the bank statement appears as a tab of its own in Accounting.

## Setting up {#einrichten}

1. **Settings › Modules:** switch on “Accounting”. With “Demo” you can try the module with made-up data first.
2. **Give the permission:** under Settings › Users & permissions, give the permission “Accounting” to everyone who may handle invoices and receipts (for example the treasurer).
3. **Add a bank account:** under Settings › Bank accounts, enter at least one account of the club. It appears on every invoice. Without an account, a yellow notice on the “Invoices” page reminds you.
4. **Check the club address:** address, email and phone appear in the letterhead. You maintain them once, centrally, under Settings › Club.
5. **Set up the mailbox (for sending by email):** under Settings › Mailbox. Without a mailbox you can download the PDF and print it.
6. **Accounting › Settings:** enter the number range, payment term and tax details. For donation receipts, also enter the details of the exemption notice. Until you do, the button “+ New donation receipt” stays locked.
7. **Expenses and cash:** the treasurer gets the permission “Expenses”, auditors get “Audit” (view only). Under Settings › Expenses & cash enter the opening balance of the preset cash box, add more cash boxes if needed and set account and sphere per expense type under Settings › Bookkeeping.

## Admin area {#verwaltung}

Accounting has tabs at the top, always in the same order: **Invoices**, **Donation receipts**, **Companies & sponsors**, **Expenses**, **Cash book**, **Income statement** and **Settings**. Anyone with only “Expenses” or “Audit” sees just Expenses, Cash book and Income statement (and with “Expenses” the expense settings). The buttons for creating new records are on the right of the tab row. A number on the “Invoices” tab shows how many invoices are overdue.

![The tabs of Accounting, with the buttons for creating records on the right.](bild: seite=bh-rechnungen; ziel=.tabrow; rahmen=#biNew)

### Tab “Invoices” {#bh-rechnungen}

Here you see all invoices and create new ones.

#### Figures and filters

Three tiles are at the top: **Open** (total and number of unpaid invoices), **Overdue** (the invoices past their payment term, in red) and **Paid** in the current financial year (by payment date). Below them you filter the list:

- **Status:** Open, Overdue, Paid, Cancelled or All. The first two buttons show a count.
- **Year:** one year (up to five years back, by invoice date) or “all”. If your financial year does not start on 1 January, the field is called “Financial year” and shows e.g. “2026/27”.

If a bank statement has been imported, a line under the filters shows the date up to which it reaches. That way nobody is chased who has already paid.

![The invoice list with figures, status filter and year selection.](bild: seite=bh-rechnungen; klick=#biS [data-f="alle"]; rahmen=[data-paid]; ziel=#main)

#### The list

| Column | Content |
|---|---|
| Recipient | Name of the company, or “Last name, first name” of the member. Below: member or company, service period, “sent” and “reminded 2×” |
| No. | Consecutive invoice number, for example R-2026-0001 |
| Date, Due | Invoice date and payment term (overdue in red) |
| Amount | Total including VAT |
| Status | Open, Overdue, Paid (with payment date) or Cancelled |

At the end of each row are **PDF** (opens the invoice), **Paid** (for open invoices, marked in the picture) and **Details**. Invoices to members that appear as an open item in Members have no “Paid” button. You record those payments there (see Working with other modules).

#### New invoice

“+ New invoice” opens the window. At the top you choose whether the invoice goes **to company / sponsor** or **to member**, and then the recipient from the list. If the company does not exist yet, the link “Add company →” takes you to the company list.

![The “New invoice” window with recipient, dates, account and line items.](bild: seite=bh-rechnungen; klick=#biNew; ziel=dialog)

- **Invoice date and Payable by:** the payment term comes from the setting (default 14 days) and follows the invoice date.
- **Service period:** for example “Season 2026/27”. It appears on the invoice and in the list.
- **Department (optional):** appears if departments exist. With a department, its bank account is printed on the invoice.
- **Account on the invoice:** the default is the department’s account, otherwise the default account. You can change it. The invoice keeps the account from the invoice date even if you later change the account in the settings.
- **Line items:** for each line, service, quantity, net price and VAT (19 %, 7 % or none). “+ Item” adds a line, the cross removes it. Below, the window works out net, VAT per rate and total. If you choose a company that has annual items stored, the window suggests them.
- **Note on the invoice (optional):** free text, for example a thank-you.
- **Send to the recipient by email right away:** sends the invoice as a PDF. Locked while no mailbox is set up.

“Create invoice” creates and numbers the invoice. Numbers run per year (R-2026-0001, -0002 …). If **small business** is switched on, the “VAT” column and the tax disappear, and the invoice carries the note under § 19 UStG. An invoice to a **member** also appears as an open item in Members, where it can be collected by direct debit or paid by transfer.

> Invoices cannot be edited after they have been created. If there is a mistake, cancel the invoice (see below) and write a new one.

#### Invoice details

“Details” shows the line items, the status (for paid invoices with date and payment method), when the invoice was sent and to which address. Depending on the situation, the window offers these buttons:

![The window of an invoice with line items, status and buttons.](bild: seite=bh-rechnungen; klick=[data-inv]; ziel=dialog)

- **PDF:** opens the invoice for printing or saving. Next to the bank details there is a **QR code for the banking app** with payee, IBAN, amount and invoice number (not for direct debit or credit notes).
- **Send by email** or **Send again:** sends the invoice with the PDF to the stored address. If the address or the mailbox is missing, Clubwerk tells you.
- **Send reminder:** only for overdue, open invoices. A friendly payment reminder with a new PDF goes out. Each further one is counted (“2nd payment reminder”), and the list remembers how often a reminder was sent.
- **Mark as paid:** opens the “Record payment” window (see below). For member invoices with an open item the button is missing.
- **Reopen:** makes a company invoice that was marked as paid open again, for example after a typing mistake.
- **Cancel invoice:** bottom left, after a short reason (at least three characters). The number stays used, the invoice no longer counts as open and the PDF carries the note “cancelled”. An invoice that counts as paid through the bank statement can only be cancelled once the assignment there has been removed.

#### Record payment

The window asks **when** the money arrived and **how** it was paid (bank transfer, cash, direct debit or offset). “Paid” records it and sets the invoice to paid. The “Paid” button in the list opens the same window.

![The “Record payment” window.](bild: seite=bh-rechnungen; klick=[data-paid]; ziel=dialog)

#### Annual invoices

“Annual invoices …” writes one invoice at once for every company with annual items stored, and only once per company and year. You choose the **year**, the **invoice date** and the **service period**. In the list you tick the companies that get an invoice. Companies already invoiced are greyed out with the invoice number. “Send by email right away” sends each invoice to the company’s address. Companies without an email address are marked; their invoice is still created and you print it. The button at the bottom counts how many invoices will be created.

![The “Annual invoices” window with the choice of companies.](bild: seite=bh-rechnungen; klick=#biYear; ziel=dialog)

> You maintain the items for each company. If the price for perimeter advertising changes, change it once there, before the next annual run.

### Tab “Donation receipts” {#bh-spenden}

Here you issue donation acknowledgements.

![The “Donation receipts” tab with figures and list.](bild: seite=bh-spenden; ziel=#main)

Three tiles show what has been confirmed this year: **Confirmed** (all active receipts), **Cash donations** and **Donations in kind & waivers**, each with a count. If you choose another **Year** at the top, the last two tiles apply to that year.

The list has the columns **No.** (for example SQ-2026-0001), **Donor** (with “Member”, “Company” or “one-time donor” and the note “sent”), **Type**, **Date of donation** and **Amount**. At the end of each row:

- **PDF:** the receipt on one A4 page, with the amount in words and the details of the exemption notice.
- **Send:** sends the receipt by email. The button is locked if no address is stored or no mailbox is set up.
- **Cancellation:** only if a receipt was issued wrongly. You give a short reason, the number stays used, and the row turns grey with the mark “cancelled”.

#### New donation receipt

![The “New donation receipt” window for a cash donation.](bild: seite=bh-spenden; klick=#bdNew; ziel=dialog)

At the top you choose the **donor**: a member, a company or a **one-time donor**. For a one-time donor you enter name, address and optionally an email address. For members and companies Clubwerk uses the stored address. If it is missing you get a notice, because a receipt without a complete address is not valid.

Then you choose the **type**:

- **Cash donation:** amount and date of donation (not in the future).
- **Donation in kind:** value, date and an exact description (what, age, condition, original purchase price). Also the **origin** (private assets, business assets or not stated) and whether documents for the valuation are available.
- **Waived reimbursement:** the amount waived and a description of the expenses, for example travel costs to a tournament. The claim must previously have been granted by contract, or by the constitution or a board decision. The window says so too.

![The same window for a donation in kind, with description and origin.](bild: seite=bh-spenden; klick=#bdNew; klick2=#dKind button[data-k="sach"]; ziel=dialog)

“Create donation receipt” creates the receipt and opens the PDF straight away. If details are missing, Clubwerk tells you exactly which.

> A donation receipt is only valid as long as the notice is no more than 5 years old (assessment notice: 3 years). You enter the date in the settings.

### Tab “Companies & sponsors” {#bh-firmen}

Here you set up companies once and reuse them for every invoice and donation.

![The “Companies & sponsors” tab with the company list.](bild: seite=bh-firmen; ziel=#main; rahmen=#bpNew)

The search field “Search company” filters by name, place and contact person. The list shows:

| Column | Content |
|---|---|
| Company | Name, below it postcode and place (and “inactive”) |
| Contact person | Name and email address |
| Annual amount | Total of the annual items including VAT |
| Open | Total of the open invoices |
| Latest | Year of the last annual invoice, otherwise the number of invoices so far |

**Invoice** opens the “New invoice” window, already filled with the company and its annual items. **Edit** opens the company.

#### Adding and editing a company

![The window of a company with address, annual items and note.](bild: seite=bh-firmen; klick=[data-ed]; ziel=dialog)

- **Master data:** company or name, customer number, department, contact person, email (for sending invoices), phone, VAT ID, address. Leave the country empty if the company is in Germany.
- **Annual items:** what the company gets every year, for example perimeter advertising, shirt advertising or an advert in the club magazine. Leave empty if you only invoice individually.
- **Note (internal):** only users with the permission “Accounting” can see it. It is stored encrypted in the vault.
- **Active:** inactive companies get no annual invoice and cannot be selected. Meant for sponsors who have stopped.
- **Delete:** only as long as there is no invoice and no donation receipt for the company. Otherwise set it to inactive.

### Tab “Expenses” {#bh-ausgaben}

Everything the club has paid – with a receipt, from the bank account or a cash box. At the top, three figures for the chosen year: all expenses, those from the bank account (with the number not yet matched with the bank statement) and those from the cash box (with the number of self-issued receipts).

![The “Expenses” tab with figures, suggestions and list.](bild: seite=bh-ausgaben; ziel=#main; rahmen=#axNew)

#### To record

This card shows deliveries from Sales (invoice or till receipt with an amount) and debits from the bank statement that have no expense yet. “Record …” opens the window with date, amount and payee already filled in. Clubwerk takes over a delivery’s receipt, and a debit is matched in the bank statement straight away. So nothing is recorded twice. Debits only appear with the “Bank statement” permission.

#### The list

Filters: **Booked**, **Cancelled**, **All**, plus year (or financial year) and expense type. For each expense: payee with purpose and type, number (A-2026-0001 …), date, paid from (bank account or cash box, “Bank statement” = matched), amount and whether there is a receipt or a self-issued receipt. “Details” opens the expense.

#### New expense

![The “New expense” window.](bild: seite=bh-ausgaben; klick=#axNew; ziel=dialog)

- **Paid on**, **Amount (€, gross)**, **Payee** (companies from “Companies & sponsors” are suggested), **Expense type** and **What for** are required.
- **VAT:** only if input tax deduction is switched on in the settings.
- **Paid from:** bank account or cash box. A cash box cannot go negative, and nothing can be booked in a locked month.
- **Receipt:** “Take photo” (opens the camera on a phone or tablet) or “Choose file” (JPG, PNG, HEIC or PDF, 15 MB at most). Photos are made smaller before uploading. If there is no receipt, explain why with “No receipt available …” as a **self-issued receipt**.

> The receipt is frozen when saving (checksum) and stored encrypted in the vault. It cannot be replaced afterwards; if the file has been altered, Clubwerk says so when opening it.

#### Details and cancellation

![The window of an expense with receipt photo.](bild: seite=bh-ausgaben; klick=[data-ax]; ziel=dialog)

The window shows all details, the receipt photo and “Open receipt”. An expense is never deleted: “Cancel expense” (with a reason) keeps the number and receipt, but the expense no longer counts. For a cash expense, the money returns to the cash box in the books with today’s date. If the expense is linked to a debit, first undo the match in the bank statement.

### Tab “Cash book” {#bh-kasse}

The cash book shows every movement per cash box and month with a running balance: cash receipts from the modules (cash sales, events, entry fees, invoices and items paid in cash – combined per day and type), cash expenses, cash transfers, transfers between cash boxes, cash differences and cancellations. At the top you choose the cash box and month; below are the opening balance, income and expenses and the balance per cash book.

![The cash book of the bar till with balance and cash count.](bild: seite=bh-kasse; ziel=#main; rahmen=#kbCount)

#### Cash count

![The “Cash count” window with count sheet.](bild: seite=bh-kasse; klick=#kbCount; ziel=dialog)

Count the money and enter the number of each note and coin. Clubwerk shows the balance per cash book and the difference. If the count differs, a reason is required; the difference is booked as its own entry “Cash difference per cash count”. The month’s cash counts are listed below the cash book.

#### Cash transfer

![The “Cash transfer” window.](bild: seite=bh-kasse; klick=#kbMove; ziel=dialog)

“From the bank into the cash box” (e.g. change), “From the cash box to the bank” (deposit) or “To another cash box”. Single entries can be cancelled with the ✕ in the row (with a reason, reversal dated today).

#### Lock month

Once a month is over, lock it (“Lock month …”), ideally after a cash count. Months are closed in order. After that the month cannot be changed: anything added later with a date in that month appears as “Late entry for locked months” in the next open month. The overview reminds you as long as the previous month is open.

#### PDF and Excel

Below the list: the month’s cash book as a PDF or Excel sheet, for example for the audit.

### Tab “Income statement” {#bh-euer}

![The income statement per sphere.](bild: seite=bh-euer; ziel=#main; hoehe=560)

The income statement (cash basis) for the chosen (financial) year: per sphere (non-profit area, asset management, special-purpose operation, commercial operation) the income and expenses per revenue or expense type and the surplus. It counts by payment date and only what runs through Clubwerk. You set the sphere per type under Settings › Bookkeeping. If income in a special-purpose or commercial operation exceeds the threshold, a note appears. “Excel” downloads the report. With input tax deduction, the input tax paid is shown under “Expenses”.

### Tab “Settings” {#bh-einstellungen}

The settings consist of cards one below the other. Each has its own “Save” and sends only its own fields. The order: Invoices, Tax & tax office, Donation receipts, Letterhead & bank accounts, Expenses & cash (Expenses, Expense types, Cash boxes, Cash receipts per cash box), Transfer settings.

#### Invoices

![The “Invoices” card.](bild: seite=bh-einstellungen; ziel=[data-set="rechnungen"])

- **Number range:** prefix of the invoice numbers (default “R-”). Numbers run per year: R-2026-0001, -0002 …
- **Payment term (days):** how many days after the invoice date payment is due (default 14).
- **Introduction text:** appears above the line items, for example “Thank you for your support!”
- **Footer (optional):** at the bottom of every invoice, for example board and register court.

#### Tax & tax office

![The “Tax & tax office” card.](bild: seite=bh-einstellungen; ziel=[data-set="steuer"])

These details apply to invoices and donation receipts. Advertising services are usually subject to VAT for a club. If in doubt, ask your tax adviser.

- **Tax number** and **VAT ID** (optional) appear on the invoices.
- **VAT (default):** the rate new items get (19 %, 7 % or none).
- **Small business:** switches VAT off (§ 19 UStG). The invoices carry the note.
- **Tax office**, **Tax number (at the tax office)** (empty = same as on invoices), **Type of notice** (exemption notice or assessment notice), **Date of the notice** and **Assessment period:** the mandatory details on the donation receipt.

> If the details of the notice are missing, the “Donation receipts” tab shows a yellow notice “Enter →”. One click takes you straight to this card.

#### Donation receipts

![The “Donation receipts” card.](bild: seite=bh-einstellungen; ziel=[data-set="spenden"])

- **Number range:** prefix of the receipt numbers (default “SQ-”).
- **Place of issue:** empty = the club’s place.
- **Charitable purposes:** the tax-privileged purpose, as in the notice, for example “Promotion of sport”.
- **Signature (name)** and **Role:** who signs the receipt, for example the treasurer.

#### Letterhead & bank accounts

This card is display only. Address, email and phone in the letterhead come from Settings › Club, the bank accounts from Settings › Bank accounts. The links lead there. The table shows each account with its IBAN and the departments it applies to (“all” if none is restricted). The default account carries the mark “Default”.

#### Expenses

![The “Expenses” card.](bild: seite=bh-einstellungen; ziel=#bsAus)

- **Number range:** prefix of the expense numbers (default “A-”), consecutive per year.
- **Club can deduct input tax:** off by default – expenses are then recorded gross. When on, you choose the tax rate per expense and the input tax goes into the DATEV export.

#### Expense types

![The “Expense types” card.](bild: seite=bh-einstellungen; ziel=#bsTypes; hoehe=420)

Preset types include drinks purchasing, court care and grounds, electricity, association fees and coaches. You can rename them, retire them and add new ones with a sphere. Set account and sphere per type under Settings › Bookkeeping.

#### Cash boxes

![The “Cash boxes” card.](bild: seite=bh-einstellungen; ziel=#bsCash)

One cash box is preset; add more with “+ Cash box” (name, start, opening balance). The opening balance can be changed as long as nothing has been booked in the cash box. The **main cash box** receives all cash receipts without their own assignment. Retiring only works with an empty cash box.

#### Cash receipts per cash box

Only with more than one cash box: for each revenue type (e.g. tournament entry fees) choose which cash box the cash goes into. Without a choice it goes into the main cash box.

#### Transfer settings

Exports settings, companies (with annual items), expense types and cash boxes as a file and imports them into another Clubwerk installation. Invoices, donation receipts, expenses, cash book entries and bank accounts are not transferred. On import, entries with the same name (ignoring upper/lower case) are updated, new ones are created and nothing is deleted. The message says for each kind how many were new and how many were updated.

### Bank statement {#kontoauszug}

You assign payments to invoices through the **bank statement**. With Members it is under Fees & payments › Bank statement; without Members it is a tab of its own in Accounting. How the bank statement works is explained in the core guide. For Accounting, this applies:

- Clubwerk assigns a payment to an invoice if the **invoice number** appears in the payment reference. If the amount matches too, the assignment counts as certain. If more was paid, it counts as probable and the rest stays unassigned.
- If the amount is too low, there is no automatic assignment. You record part payments by hand on the invoice.
- An invoice paid this way carries the payment method “Bank statement”. If you want to reopen or cancel it, first remove the assignment in the bank statement.
- To assign, you need the permission “Import and assign bank statements” and also “Accounting”.
- **Debits:** with Accounting, the bank statement also keeps debits. If one matches an expense from the bank account (same amount, up to 14 days apart, payee in the name), Clubwerk suggests it. Other debits appear under Expenses › To record.

## Tablet and app {#tablet-app}

Accounting has no page at the tablet or in the member app. You send invoices and receipts by email as a PDF or print them. Take receipt photos in the admin area on a phone or tablet with “Take photo”.

## Permissions {#rechte}

| Permission | What it allows |
|---|---|
| Accounting | Invoices, donation receipts, companies & sponsors and their settings: write, send, remind, record and cancel, assign invoices and expenses in the bank statement (in addition to the bank statement permission) |
| Record expenses and cash book | Record and cancel expenses with receipts, cash count, cash transfer, lock months, set up expense types and cash boxes (the treasurer) |
| Audit | View and download expenses with receipts, cash book and income statement only |

Whoever has “Accounting” also sees the names and addresses of invoice recipients.

## Working with other modules {#zusammenspiel}

- **Members:** invoices to members appear as an open item in Members and can be collected or recorded as paid there. When the item is paid, the invoice is paid too. If it is cancelled or becomes open again (for example after a returned direct debit), the invoice follows.
- **Bank statement (core):** assigns incoming payments to open invoices and debits to expenses, see above.
- **Sales:** deliveries with an amount appear under Expenses › To record; cash sales appear in the cash book.
- **Bookkeeping (Settings):** expenses, cash transfers and cash differences go into the DATEV posting batch; set account and sphere per expense type there.
- **All modules with cash:** their cash receipts appear in the cash book (main cash box or the chosen one).
- **Settings:** address (Club), bank accounts and mailbox come from there.
- **Overview:** shows the number of open invoices, the annual invoices still missing a warning about overdue invoices and – with the “Expenses” permission – a note while a cash box’s previous month is not locked.
- **Search (Ctrl/⌘ K):** finds invoices by number or recipient and companies by name or customer number.
- **Privacy:** invoices, receipts and expense receipts are accounting records and are never deleted automatically (legal retention: receipts 8 years, books 10 years). A member’s data report includes their invoices and donations. When duplicate members are merged, they move along. If a member has open invoices, Clubwerk points this out. Paid and cancelled invoices keep the name.
- **Setup assistant:** contains the step “Invoices and tax”.
