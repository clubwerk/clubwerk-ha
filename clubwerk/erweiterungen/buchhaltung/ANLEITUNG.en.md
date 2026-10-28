# Accounting
<!-- kurz: Invoices to companies and members, donation receipts in the official format, and sponsors with annual items. -->

## What is the module for? {#wofuer}

Accounting writes invoices to sponsors, companies and members, keeps track of what has been paid, and reminds people by email about overdue amounts. It also issues donation receipts (donation acknowledgements) in the official format: for cash donations, donations in kind and waived expense reimbursement. You set up each sponsor once, with their annual items (for example perimeter advertising). The annual invoices are then created with one click.

The module works on its own. Without Members, invoices and donation receipts go only to companies and one-time donors, and the bank statement appears as a tab of its own in Accounting.

## Setting up {#einrichten}

1. **Settings › Modules:** switch on “Accounting”. With “Demo” you can try the module with made-up data first.
2. **Give the permission:** under Settings › Users & permissions, give the permission “Accounting” to everyone who may handle invoices and receipts (for example the treasurer).
3. **Add a bank account:** under Settings › Bank accounts, enter at least one account of the club. It appears on every invoice. Without an account, a yellow notice on the “Invoices” page reminds you.
4. **Check the club address:** address, email and phone appear in the letterhead. You maintain them once, centrally, under Settings › Club.
5. **Set up the mailbox (for sending by email):** under Settings › Mailbox. Without a mailbox you can download the PDF and print it.
6. **Accounting › Settings:** enter the number range, payment term and tax details. For donation receipts, also enter the details of the exemption notice. Until you do, the button “+ New donation receipt” stays locked.

## Admin area {#verwaltung}

Accounting has four tabs at the top, always in the same order: **Invoices**, **Donation receipts**, **Companies & sponsors** and **Settings**. The buttons for creating new records are on the right of the tab row. A number on the “Invoices” tab shows how many invoices are overdue.

![The four tabs of Accounting, with the buttons for creating records on the right.](bild: seite=bh-rechnungen; ziel=.tabrow; rahmen=#biNew)

### Tab “Invoices” {#bh-rechnungen}

Here you see all invoices and create new ones.

#### Figures and filters

Three tiles are at the top: **Open** (total and number of unpaid invoices), **Overdue** (the invoices past their payment term, in red) and **Paid** in the current year. Below them you filter the list:

- **Status:** Open, Overdue, Paid, Cancelled or All. The first two buttons show a count.
- **Year:** one year (up to five years back) or “all”.

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

- **PDF:** opens the invoice for printing or saving.
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

### Tab “Settings” {#bh-einstellungen}

The settings consist of five cards one below the other. Each has its own “Save” and sends only its own fields. The order: Invoices, Tax & tax office, Donation receipts, Letterhead & bank accounts, Transfer settings.

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

#### Transfer settings

Exports settings and companies (with annual items) as a file and imports them into another Clubwerk installation. Invoices, donation receipts and bank accounts are not transferred. On import, existing companies with the same name stay unchanged.

### Bank statement {#kontoauszug}

You assign payments to invoices through the **bank statement**. With Members it is under Fees & payments › Bank statement; without Members it is a fifth tab of Accounting. How the bank statement works is explained in the core guide. For Accounting, this applies:

- Clubwerk assigns a payment to an invoice if the **invoice number** appears in the payment reference. If the amount matches too, the assignment counts as certain. If more was paid, it counts as probable and the rest stays unassigned.
- If the amount is too low, there is no automatic assignment. You record part payments by hand on the invoice.
- An invoice paid this way carries the payment method “Bank statement”. If you want to reopen or cancel it, first remove the assignment in the bank statement.
- To assign, you need the permission “Import and assign bank statements” and also “Accounting”.

## Tablet and app {#tablet-app}

Accounting has no page at the tablet or in the member app. You send invoices and receipts by email as a PDF or print them.

## Permissions {#rechte}

| Permission | What it allows |
|---|---|
| Accounting | All four tabs: write, send, remind, record and cancel invoices, manage companies, issue, send and cancel donation receipts, change settings, assign invoices in the bank statement (in addition to the bank statement permission) |

It is a single permission. Whoever has it also sees the names and addresses of invoice recipients.

## Working with other modules {#zusammenspiel}

- **Members:** invoices to members appear as an open item in Members and can be collected or recorded as paid there. When the item is paid, the invoice is paid too. If it is cancelled or becomes open again (for example after a returned direct debit), the invoice follows.
- **Bank statement (core):** assigns incoming payments to open invoices, see above.
- **Settings:** address (Club), bank accounts and mailbox come from there.
- **Overview:** shows the number of open invoices, the annual invoices still missing and a warning about overdue invoices.
- **Search (Ctrl/⌘ K):** finds invoices by number or recipient and companies by name or customer number.
- **Privacy:** invoices and receipts are accounting records and are never deleted automatically (legal retention: receipts 8 years, books 10 years). A member’s data report includes their invoices and donations. When duplicate members are merged, they move along. If a member has open invoices, Clubwerk points this out. Paid and cancelled invoices keep the name.
- **Setup assistant:** contains the step “Invoices and tax”.
