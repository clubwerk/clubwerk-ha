# Sales and stock
<!-- kurz: Book at the tablet instead of a tally sheet – accounts, tabs, events, billing, deliveries, stock and ordering. -->

## What is the module for? {#wofuer}

Sales replaces the tally sheet at the bar. Members tap their name on the tablet, enter their PIN, tap their drinks, snacks or balls and book. Guests are put on a tab or pay in cash. In the admin area you see all bookings, bill the accounts, run events and evaluate sales. Under **Stock** you handle deliveries, stock, stocktakes and ordering.

The module works on its own. Without member management you create the accounts yourself under “Accounts” and bill by hand (Excel or the manual entry list). With member management the members come from there, and you can collect sales by direct debit.

The admin area for sales has two entries in the menu on the left: **Sales** (Bookings, Billing & export, Events & tabs, Accounts, Statistics, Settings) and **Stock** (Order, Deliveries & receipts, Stock & stocktake, Items). It is still one single module with one single switch.

## Setting up {#einrichten}

1. **Settings › Modules:** switch on “Sales”. With “Demo” you can try the module out first with invented data.
2. **Set the tablet password:** Settings › Tablet. Without a password the tablet stays locked.
3. **Create items:** Stock › Items. Either one by one with “+ New item” or with “Import …” from an Excel list.
4. **Set the order of the categories:** Sales › Settings. This is how the tiles appear on the tablet.
5. **Create accounts:** Sales › Accounts (with member management the members come from there). Anyone using the tablet needs a PIN, which they set themselves the first time they book.
6. **Grant permissions:** Under Settings › Users & permissions, give the right permissions to whoever should bill, order or record deliveries (see below). Then the tablet is ready to use.

## Admin area {#verwaltung}

The tabs of Sales are at the top: **Bookings**, **Billing & export**, **Events & tabs**, **Accounts**, **Statistics** and **Settings**. Each tab only appears if you have the matching permission. The “Accounts” tab belongs to accounts & PINs and has its own guide.

### “Bookings” page {#buchungen}

![The tabs of Sales, “Bookings” on the left.](bild: seite=buchungen; ziel=.tabrow:has(> .drinktabs))

Every single booking in the period is listed here. You cancel wrong bookings here and add forgotten ones. The list first shows 150 entries, “Load more” fetches the rest.

#### Choosing the period and account

![Period and account filter.](bild: seite=buchungen; ziel=#rng)

With **From** and **To** and “Show” you choose the period; “Whole season” runs from 1 January until today. Below that, **Account only** narrows the list to one person or team. A total is then shown as well: how many pieces and how much money that account has on its bill for the period.

#### List

The columns: **Time**, **Account** (for an event its name is shown underneath), **Type**, **Item**, **Quantity**, **Amount**. The type shows where the booking goes:

| Type | Meaning |
|---|---|
| Account | onto the account of a person or team, paid with billing |
| Club free | free of charge for the club, only counted (stock stays correct) |
| Guest cash | a guest paid in cash |
| Tab · open / cash / card / written off | booking on a guest tab and its status |
| Event / List · open / cash / card | booking at an event |
| transferred from tab / event | was transferred to an account |
| billed | is already in a billing |

Cancelled bookings stay in the list in grey, with a note of who cancelled them.

#### Add afterwards

![Card “Add afterwards”.](bild: seite=buchungen; ziel=.card:has(#nbSave))

Here you add something that was forgotten at the tablet: **Account**, **Item**, **Quantity** and **Date**, then “Add afterwards”. If you choose “free amount” as the item, **Amount €** and **What for?** (for example an entry fee) appear instead. Bookings can only be added to active accounts.

#### Cancellation

![Confirmation when cancelling a booking.](bild: seite=buchungen; klick=[data-cx]; ziel=#askBox)

The “Cancellation” button takes a booking back: the amount disappears from the account, and the item goes back into stock. If the booking is **already billed**, Clubwerk tells you which billing it is in. You then have these options:

- **Book credit:** the amount is deducted from the account in the next billing.
- **Undo run and cancel:** if there is a sales collection from which nothing has been collected yet, it is better to undo the whole run. The booking is then cancelled normally, and the other accounts in the run are open again.
- If the matching item in member management has already been cancelled, the booking is cancelled without a new credit.

> The tablet can only take back bookings that are not yet billed (“Undo”). After that the admin area is always responsible. For deleted accounts Clubwerk refuses the cancellation: refund the amount in cash and correct the stock under Stock › Stock & stocktake if needed.

### “Billing & export” page {#abrechnung}

![The tabs of Sales with the billing buttons next to them on the right.](bild: seite=abrechnung; ziel=.tabrow:has(> .drinktabs))

This is where you bill: get the list, debit the amounts in the club administration, mark them as billed here. The list shows exactly the status given under “List status”. Anything booked at the tablet afterwards stays open for the next billing.

#### Buttons at the top

The buttons are on the right next to the tabs (see the picture above).

- **Refresh list** fetches the current status.
- **+ Amount to account** books a free amount with a text (food, entry fee, a crate for the party) to an account. It is paid like any tablet booking.
- **Manual entry list** opens the list for transferring the amounts by hand (see below).
- **Mark all as billed** closes all accounts on the list. Only someone with the “Billing” permission may do this.
- **Excel** downloads the billing as an Excel file: one row per account with the quantities per category, plus the sheets “Bookings”, “Reconciliation” and “Events” for the chosen period.

![The “Book an amount to an account” window.](bild: seite=abrechnung; klick=#addAmt; ziel=dialog)

#### How it works

![The collapsible short guide.](bild: seite=abrechnung; klick=details.howto summary; ziel=details.howto)

“How it works” gives the procedure in three steps: download Excel or open the manual entry list, debit the amounts in the club administration, mark the accounts as billed here. Their open amount is then 0.

#### Key figures

![The four key figures at the top.](bild: seite=abrechnung; ziel=.kpis)

**Total due**, **Accounts with open amount**, **List status** (the time up to which billing applies) and **Last billed**. If members still have open amounts on an event list, a red notice warns you: these amounts only appear after they have been transferred to the accounts (see Events & tabs) – ideally before the export.

#### Collect by direct debit

![Card “Collect by direct debit”.](bild: seite=abrechnung; ziel=.card:has(#sepaGo))

This card only exists with member management and the “Members: finances” permission. A window shows in one go who pays how much (relatives with the payer) and suggests the earliest collection day. It lists clearly what does **not** work by direct debit (no or revoked mandate, teams, “Not a member”) and what to do about it. One click creates the SEPA file, separate from the membership fees. The accounts collected are marked as billed at the same time. If you discard a collection, Clubwerk asks whether the run should be undone straight away.

#### List of open accounts

The table shows for each account: **Account**, **open since**, the piece counts per **category** (in your order), **Amount** and – with the “Billing” permission – the **billed** button. The total is at the bottom. Teams carry the label “Team”. Red marks what is additionally still open on an event list. With **billed** you close a single account; Clubwerk asks first.

![Confirmation when billing an account.](bild: seite=abrechnung; klick=[data-settle]; ziel=#askBox)

#### Manual entry list

![The manual entry list: the ready-made booking text to copy (the accounts to tick off follow below).](bild: seite=abrechnung; klick=#abtipp; ziel=#dialog .row:has(#btCopy))

For the club administration without a collection: the list is sorted by surname, teams are at the end. Above the list is the ready-made **booking text**. You can change it as a template (placeholders `{von}`, `{bis}`, `{jahr}`, `{verein}`) and apply it with “Copy booking text”. Tapping an amount copies it. With the box you tick off what has already been entered (the tick applies on this device and only as long as the amount stays the same). “Print / save as PDF” makes a paper list.

#### Open sales items in member management

Items that are already billed or were created by hand but are not yet paid appear in a card of their own (payer, item, due, amount). They are included in the next collection. This card only appears if there are such items.

#### Previous billings

![Card “Previous billings”.](bild: seite=abrechnung; klick=.card:has([data-undo]) h3; ziel=.card:has([data-undo]))

Every billing run with date, accounts, amount and who made it. **Undo** reverses it: the amounts are open again afterwards. This does not work for runs that came from a direct-debit collection (those are undone in member management: “Undo run”), nor if a member from the run has since been deleted.

#### Report for a period

![Card “Report for a period”.](bild: seite=abrechnung; klick=#main > .card:last-child h3; ziel=#main > .card:last-child)

Choose From and To. The key figures also apply to the sheets in the Excel file: **Booked to accounts**, **Guests cash & tabs**, **Events (due)** and **Free of charge (value)**.

### “Events & tabs” page {#veranstaltungen}

![The tabs of Sales, “Events & tabs” is selected.](bild: seite=veranstaltungen; ziel=.tabrow:has(> .drinktabs))

An event (tournament, summer party, spoon cup …) gets its own prices and its own billing list. At the tablet people add their names and put drinks on their tab; payment is ticked off here. If you only have the “Billing” or “Export” permission, you only see the tabs here.

#### New event

![Card “New event”.](bild: seite=veranstaltungen; ziel=.card:has(#evAdd))

Name, date and – under **Copy items & prices from** – either “all items at normal price” or an earlier event with its item selection and prices. “Create” sets it up. Then you check the items & prices and activate it.

#### The card of an event

![Header of an event: name, status and buttons.](bild: seite=veranstaltungen; ziel=[data-evcard] > .row)

The heading gives name and date, followed by the status: **active – tablet books to this list**, **not active** or **Cash register closed**. To the right are the buttons (with the “Events” permission):

- **Items & prices (n):** only ticked items appear at the tablet during the event, with the price from the right-hand column. “all items” and “none” tick or untick everything.
- **Activate / Deactivate:** while an event is active, the tablet only shows its list and books to it.
- **Count & close cash register:** you enter the cash counted (leave empty if not counted separately). Clubwerk works out the difference from the target. After closing, open amounts can still be ticked off or transferred. The button is then called “Recount cash”.
- **Delete:** only for events that are not active. If bookings were made, it only disappears from the list; sales and stock stay in the statistics.

Below are five key figures: **Sales**, **Cash (belongs in the till)** (with “of which … without name” and the counted cash with its difference), **Paid by card**, **Transferred to accounts** and **Still open**.

![The five key figures of an event.](bild: seite=veranstaltungen; ziel=[data-evcard] .kpis)

#### Transfer to accounts (treasurer)

If the list has members who did not pay directly, a notice appears with the button **Transfer to accounts (…)**. It books their amounts to their accounts, and they are paid with the next billing (“Transfer” permission). Guests without an account cannot be transferred: first assign them to a member (“Assign to a member …”) or collect cash.

#### Billing list

![The billing list of an event.](bild: seite=veranstaltungen; ziel=[data-evcard] .evscroll)

The list shows for each name **Units**, **Amount** and **Status** (open, paid in cash, card, to accounts). With “All / Open / Paid” you filter. With **+ Add** you put names on the list: a member from the member list or a guest with a free name. The cross removes a name that has not booked anything yet.

With **Settle up …** you open, for an open name, the window with **Paid in cash**, **Paid by card** and – for guests without an account – **Assign to a member …**. Two lists open under the list: **Payments** (who paid when and how, with **Undo**) and **Items sold** (quantity, sales and “Club free”).

#### Guest tabs

![The key figures of the guest tabs.](bild: seite=veranstaltungen; ziel=#deckelBox .kpis)

Guests and visiting teams are put on a tab at the tablet and pay before they go home. You see here what is open: **Open tabs**, **Still open**, **Paid in cash today**, **By card today**. If a tab has been open for more than a day, a red notice warns you (“probably forgot to pay”).

![Card “Open” with the open tab.](bild: seite=veranstaltungen; klick=#deckelBox .card:has([data-tx]) h3; ziel=#deckelBox .card:has([data-tx]))

The **Open** card shows the name, what has been put on the tab, when the tab was opened and the open amount. With **Settle up …** (permission “Events” or “Transfer”) you open the window:

![The “Settle tab” window.](bild: seite=veranstaltungen; klick=[data-tx]; ziel=dialog)

![Transfer a tab to an account.](bild: seite=buchungen; klick=.drinktabs [data-tab="veranstaltungen"]; klick2=[data-tx]; klick3=#txT; ziel=dialog)

![Write off a tab.](bild: seite=veranstaltungen; klick=[data-tx]; klick2=#txW; ziel=dialog)

- **Paid in cash** or **Paid by card:** ticks the tab off.
- **Transfer to an account …:** books the amount to an account, for example the club’s own team that invited the opponents. It is paid with the next billing.
- **Write off …** (red, set apart): the amount is no longer collected. The items count as free of charge, the stock stays correct, and your reason is in the log.

![Card “Closed”.](bild: seite=veranstaltungen; klick=#deckelBox .card:has([data-tr]) h3; ziel=#deckelBox .card:has([data-tr]))

The card **Closed (last 30 days)** shows who paid when and how. **Reopen** takes back a cash payment; the tab is then open again.

### “Statistics” page {#auswertung}

![The tabs of Sales, “Statistics” is selected.](bild: seite=auswertung; ziel=.tabrow:has(> .drinktabs))

The statistics show sales, items sold and popular times, always compared with the previous year. At the top you choose the **year** and optionally a **category**. In the current year the comparison runs up to today.

![Filter for year and category.](bild: seite=auswertung; ziel=.filterbar)

#### Key figures

![The four key figures with their trend.](bild: seite=auswertung; ziel=.ds-kpis)

**Sales**, **Items sold**, **Bookings** and **Cancelled**, each with the change from the previous year in per cent and a small curve (solid: this year, dashed: previous year).

![The bar with bestseller, busiest day, peak time and average per sale.](bild: seite=auswertung; ziel=.ds-hl)

Below are **Bestseller**, **Busiest day**, **Peak time** and **Avg. per sale**.

#### The best-selling items and revenue by category

![The best-selling items.](bild: seite=auswertung; ziel=.card:has(.ds-top))

The ranking shows the quantity, the share of all items and the change from the previous year. Next to it, the ring shows revenue by category, with the split by type below (account, guest cash, event, club free).

![The “Revenue by category” ring.](bild: seite=auswertung; ziel=.card:has(.ds-donut))

#### Year calendar, months and times

![The year calendar.](bild: seite=auswertung; ziel=.card:has(.ds-heat))

The year calendar colours each day by the number of items sold (light = few, dark = many). If you move the mouse over a day, the number is shown.

#### Revenue per month

**Revenue per month** compares the months with the previous year.

![Revenue per month.](bild: seite=auswertung; ziel=.card:has(.ds-bars))

#### When do people buy?

**When do people buy?** shows weekday and time of day as dots: the bigger the dot, the more was bought.

![When do people buy?](bild: seite=auswertung; ziel=.card:has(.ds-bub))

### Settings of Sales {#vkeinst}

![The tabs of Sales, “Settings” is selected.](bild: seite=vkeinst; ziel=.tabrow:has(> .drinktabs))

Each card has its own “Save” and is only visible if you have the permission it needs.

#### Category order

![Card “Category order”.](bild: seite=vkeinst; ziel=#vkCat)

This is how the categories appear at the tablet (from top left to bottom right) and in stock, billing and exports. With ▲ and ▼ you move a category; “Alphabetical” sorts them all. The items within a category are always in alphabetical order. The tablets pick up the order the next time they load. Permission: “Items & prices”.

#### Saved assignments of supplier items

![Card “Saved assignments”.](bild: seite=vkeinst; ziel=#vkMap)

Clubwerk remembers which item on the receipt belongs to which item on the tablet. The table shows supplier, item number, text on the receipt, item in the app and pack. **Forget** only deletes the assignment; at the next invoice Clubwerk asks again. Permission: “Deliveries & receipts”.

#### Frequently here on the tablet

![Card “Frequently here on the tablet”.](bild: seite=vkeinst; ziel=#vkTop)

At the top of the tablet’s start page are the members with the most bookings in the period. You set **how many names** (0 hides this) and **for what period in days**. The names are in alphabetical order so nobody sees a ranking, and without a visit count. Tablets pick up the change within a minute. Permission: “Settings”.

#### Transfer settings

![Card “Transfer settings”.](bild: seite=vkeinst; ziel=#vkFunc)

Save the settings of Sales (category order, “Frequently here”) as a file or apply them from a file, for example for a second club. Items, accounts, bookings, PINs and passwords are not included.

### “Order” page {#bestellung}

![The tabs of Stock, “Order” is selected.](bild: seite=bestellung; ziel=.tabrow:has(> .drinktabs))

Clubwerk makes a suggestion from stock, minimum stock and “order by”. You adjust the quantities and send the order to the drinks supplier, or copy the text.

#### Order details

![Card “Order details”.](bild: seite=bestellung; ziel=.card:has(#oSave))

**Supplier**, **Customer no.**, **Delivery address**, **Sender (name)** and **Phone for questions** appear in the order text. “Remember” saves them for next time.

#### What to order?

The table gives for each item the **stock**, **minimum** and **order by** and the **packs** (crates, cartons) to be ordered. Low items carry the label “low” and already have a suggested quantity: enough packs to reach “order by” (without a value, twice the minimum stock). Only items that have been delivered at least once are suggested. You set minimum stock and “order by” under Stock › Items; the item numbers come automatically from uploaded invoices. Every number can be changed.

#### Email

![Card “Email”.](bild: seite=bestellung; ziel=.card:has(#oSend))

Subject and text are built from your quantities and update as you type. You can change them by hand. You also enter **To (supplier)** and optionally **Copy to** (for example the board).

- **Send order now:** Clubwerk sends the email immediately and notes it in the log. This requires the club mailbox under Settings › Mailbox. It asks once more beforehand, because sent is sent.
- **Copy text:** for any other mail program.
- **Open in email program:** opens a ready-made email in the device’s mail program.

Below the buttons it says when the last order went out and to whom.

### “Deliveries & receipts” page {#lieferungen}

![The tabs of Stock, “Deliveries & receipts” is selected.](bild: seite=lieferungen; ziel=.tabrow:has(> .drinktabs))

Load invoices and delivery notes and credit the stock without typing anything in.

#### Dropping receipts

![Card “Drop invoices here”.](bild: seite=lieferungen; ziel=#drop)

Drag one or more files onto the card or use **Choose files** (a PDF from the supplier, a till receipt as a photo or screenshot). On a phone or tablet you photograph the receipt with **Take photo**. **Record without receipt** opens manual entry, for example for a delivery without paperwork.

#### Checking a receipt

![The “Record delivery” window (here without a receipt).](bild: seite=lieferungen; klick=#manual; ziel=dialog)

Clubwerk reads the receipt and recognises the line items. For photos and scans without text, image recognition helps; otherwise you enter the packs by hand. In the window the receipt is on the left, and on the right:

- **Supplier**, **Delivery date**, **Receipt type** (invoice, credit note, delivery note, till receipt), **Receipt no.** and **Amount**.
- For each line **On the receipt**, **Quantity**, **Item in the app** (the choice works like a suggestion; you can also create a new item there or ignore the line), **per pack** and **Single items**.
- Labels help: “remembered” (Clubwerk knows it from before), “please assign” and “please check quantity”. Deposit and empties lines are ignored by Clubwerk itself. A green message confirms when the total matches the receipt, and a notice warns if it differs.
- If the receipt is already saved (same receipt number), a red notice warns you about recording it twice.
- With **+ Row** you add a line. At the bottom it says how many single items go into stock and how many lines are not yet assigned to an item.

**Save delivery** credits the stock and remembers the assignments for next time. **Discard** throws the receipt away. With several files, “Cancel all” cancels the rest.

#### Recorded deliveries

![Card “Recorded deliveries”.](bild: seite=lieferungen; ziel=#main > .card:last-child)

The table shows **Delivery date**, **Supplier**, **Receipt** (with “view”), **Amount** and **Single items**. **Line items** shows what was delivered:

![The line items of a delivery.](bild: seite=lieferungen; klick=[data-show]; ziel=dialog)

**Delete** removes a delivery together with its receipt. The stock is reduced accordingly.

### “Stock & stocktake” page {#bestand}

![The tabs of Stock, “Stock & stocktake” is selected.](bild: seite=bestand; ziel=.tabrow:has(> .drinktabs))

Target stock = deliveries − bookings ± breakage and corrections. For a stocktake you count, enter the number, and Clubwerk books the difference as shrinkage.

#### Current stock and stocktake

The table shows **Item** (with “reorder” when the minimum stock is reached), **Category**, **Target (pieces)**, **Target in crates**, **Minimum stock** and – to fill in – **Counted: packs** and **Counted: pieces**. A negative stock is red. It usually means a delivery is still missing.

For a stocktake you count, enter packs and pieces (only filled-in rows are taken), choose the **Stocktake date** and tap **Save stocktake**. Clubwerk reports how many differences it recorded. If a difference is unusually large, it asks once more: perhaps someone made a typing error.

#### Book breakage or correction

![Card “Book breakage or correction”.](bild: seite=bestand; ziel=.card:has(#mvSave))

A broken crate or a wrong number is booked here: **Item**, **Reason** (“Breakage / spoiled” or “Correction (+/−)”), **Single items**, **Date** and **Note**, then “Book”.

#### Recent stock changes

![Card “Recent stock changes”.](bild: seite=bestand; klick=#main > .card:nth-of-type(5) h3; ziel=#main > .card:nth-of-type(5))

Every change with date, item, reason, quantity and note.

#### Reconciliation of deliveries and bookings

What was delivered, what was booked? Choose the period, and the table shows for each item: **Delivered**, **Accounts**, **Club free**, **Guest cash**, **Event**, **Breakage/corr.**, **Open** (still in stock or not booked), **Stocktake diff.** and **Shrinkage €**. A stocktake brings clarity.

### “Items” page {#artikel}

![The tabs of Stock with the item buttons next to them on the right.](bild: seite=artikel; ziel=.tabrow:has(> .drinktabs))

All items with category, price, pack, stock, minimum stock and “order by”. Hidden items are grey and carry the note “hidden”. The **category** groups items in billing; you set their order under Sales › Settings.

- **+ New item** creates an item.
- **Import …** reads items from Excel (see below).
- **Excel** downloads the item list. With this file (including the ID column) you can maintain it in Excel and read it in again.
- **Edit** (on the right in the row) opens the item.

#### Creating and editing items

![The “New item” window.](bild: seite=artikel; klick=#new; ziel=dialog)

- **Name:** as it appears at the tablet. A size at the end (“Beer 0.33”) appears on the tile in the second line.
- **Category:** existing categories are suggested, new ones are created with the item.
- **Price €**, **Single items per pack** (crate, carton, keg, packet) and **Minimum stock** and **Order by**, both in single items (bottles, bags, cans …). Without “Order by”, twice the minimum stock applies.
- **Track stock:** without the tick this item is not counted (for example coffee or food).
- **Show on the tablet:** without the tick the item is hidden. It is kept in old bookings.
- **Appearance on the tablet:** choose an **icon** from the collection, your **own image** (PNG, JPG, WebP or SVG up to 2 MB, resized to a square of 384 × 384 pixels; best is a logo or photo on a light or transparent background) or **None**. A short code from the name then appears on the tile. The preview shows what it will look like.

**Delete** (only when editing) removes the item from all lists and from the tablet. If it has already been sold or delivered, the old bookings are kept for stock and billing.

#### Importing items from Excel

![The “Import items from Excel” window.](bild: seite=artikel; klick=#aImp; ziel=dialog)

The columns expected are **Item**, **Category**, **Price**, optionally **ID**, **Pack**, **Track stock**, **Minimum stock**, **Order by** and **Active** (English column headings are recognised too). An existing item is recognised by its **ID**, otherwise by its name. New items always get a new ID. After you choose the file, a preview shows how many are **new**, how many **differ**, and how many stay unchanged or are skipped. If an existing item differs, you decide per item: **Keep stock** or **Apply from file**, or “Everywhere …” for all of them. With the tick below you hide items that are not in the file. “Apply” is only possible once everything has been decided.

## Tablet and app {#tablet-app}

Sales runs on the tablet in the clubhouse, not in the member app. In the app members only see what is open on their bar account, and only if the board has switched this on under Member app › Areas (“For me”).

### Booking at the tablet {#tablet-buchen}

![The start page of Sales at the tablet.](bild: tablet=start)

At the top are the members who have been here often lately (“Frequently here”, in alphabetical order). Below that you find all members from A to Z, with a search field and letter bar. At the very bottom are teams, **Club · free of charge**, **Guest · pay cash** and **Guest tabs**. Anyone new taps **I’m new** and enters their name; the board confirms it later.

1. **Tap your name.** The tablet then asks for the PIN. If you do not have one yet, you set one the first time (4 to 6 digits, entered twice; easy-to-guess ones like 1234 are refused). “Later” is possible, and booking carries on.
2. **Tap items.** Each tap is one piece, and the number is shown on the tile. On the right is the basket with **+** and **−**; “Clear selection” starts again.
3. **Book to my account.** The confirmation shows what was booked and how much is open.
4. **Undo** is possible for 20 seconds. After that only in the admin area (cancellation).

![Booking: item tiles and basket.](bild: tablet=start; klick=#special button.verein; klick2=#cats button[data-a])

After 60 seconds without input the tablet returns to the start page, and nothing has been booked. Tapping twice or a WiFi dropout never books twice.

![The PIN entry.](bild: tablet=start; klick=#names button[data-id])

More buttons on the booking page: **My account** shows date, item and amount of your own bookings and the open amount, only with a PIN. **Change PIN** also applies immediately in the member app. **Other member** cancels and goes back to the list.

### Free amount {#tablet-betrag}

![The “Enter amount” window.](bild: tablet=start; klick=#special button.gast; klick2=button[data-custom])

For anything that is not on the list (food, cake, entry fee, donation): key in the digits as on a till (3-5-0 gives €3.50), and a selection gives the reason. The amount is between €0.10 and €500. This does not exist for club bookings (free of charge).

### Teams, club and guests {#tablet-konten}

- **Team:** books to the team account (PIN from the board).
- **Club · free of charge:** the booking is counted but not charged to anyone. Stock stays correct.
- **Guest · pay cash:** the guest pays in cash straight away. At the end it says “Please put … in the till”.
- **Family and coaches:** family members book through the main payer by default and are not listed individually, unless member management is set otherwise. “Not a member” (for example a coach) books like a member with their own PIN.

### Guest tabs at the tablet {#tablet-deckel}

![The “New guest tab” window.](bild: tablet=start; klick=#special button.deckel)

For guests and the visiting team: enter the name (for example “Visiting team SV Musterdorf”) and **Open tab**. If the name is already open, the tablet suggests the existing tab. Then tap items as usual and tap **Put on tab**. Before they go home, the tab is opened again and **Pay now** is tapped (the amount is shown there), followed by **Paid in cash** or **Paid by card**. If nothing is on the tab, the button is called **Close tab**. Open tabs are shown at the top of the start page.

![An opened tab with the pay button.](bild: tablet=start; klick=#tabs button[data-tab])

### Event at the tablet {#tablet-veranstaltung}

If an event is active, the tablet only shows its list of names. Everyone adds themselves with **+ Add names** (a member from the list or freely as a guest) and puts items on the list, with a PIN if the member has one. **Cash sale without name** (button at the top) books in cash without a name. Payment is made at the end in the admin area.

## Permissions {#rechte}

| Permission | What it allows |
|---|---|
| Upload deliveries & receipts | “Deliveries & receipts” page, saved assignments of supplier items |
| Stock, stocktake & reconciliation | “Stock & stocktake” page |
| Prepare order (order email) | “Order” page, order details and email |
| Cancel & add bookings | “Bookings” page, “+ Amount to account” |
| View current status & export as Excel | View billing, Excel, manual entry list, statistics (for example for auditors) |
| Billing | Mark accounts as billed, undo billings, change the booking text (includes “Export”) |
| Manage events | Run events, tick off cash and card, settle tabs |
| Transfer open event amounts (treasurer) | Transfer amounts to accounts, transfer tabs to an account or write them off |
| Items & prices | “Items” page, category order |
| Settings | “Frequently here” and “Transfer settings” in Sales |

For accounts & PINs there is the permission “Add members & confirm new ones”. The “Treasurer” role already includes the permissions for billing, export and transfer.

## Working with other modules {#zusammenspiel}

- **Members:** the members and their payers come from there. Sales accounts are collected by direct debit as well (“Collect by direct debit”), and family members pay through the head of the family. Members with a €0 membership type still go through the collection. A member’s data access request includes their sales per month. Members with open amounts cannot be deleted.
- **Duties & dates:** an event in Sales can be created from a duty roster. The permanent “bar duty” is available at the tablet for clocking in.
- **Courts:** fees that a coach without membership pays land on their sales account and are paid with billing.
- **Faults:** the report form is at the tablet next to Sales.
- **Tournaments:** the entry fee runs in a separate cash report and not in the sales till.
- **Privacy:** Clubwerk never deletes the money data of Sales by itself, because statutory retention periods apply.
