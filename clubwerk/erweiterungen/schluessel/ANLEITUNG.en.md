# Keys
<!-- kurz: Key handover with both sides signing, returns and losses – recorded as a PDF. -->

## What is this module for? {#wofuer}

Who gets which key, transponder or card, when, and on what terms? The module records every handover like a paper form: both sides sign on the screen and a PDF is produced that the person receives by email. Returns and losses get their own record. At any time you can see who holds what and whom you need to ask for a key back.

The module works on its own. Without Member management you only have first and last names; people without a Clubwerk account (tenants, cleaners, tradespeople) are entered with a name and contact details.

## Setting up {#einrichten}

1. **Settings › Modules:** switch on “Keys”. With “Demo” you can try the module with made-up data first.
2. **Grant the right:** in Settings › Users & rights, give the “Keys” right to whoever should hand out keys (e.g. the groundskeeper).
3. **Create the stock:** tab “Stock” › “+ Type” (see below).
4. **Check the terms:** tab “Settings” › “Terms”. The “Standard” template is only a suggestion – please agree it with the board.
5. **Take over old numbers** (only with Member management): if members have a “key number” there, the “Issued” tab offers to take it over.

## Admin area {#verwaltung}

The “Keys” page has four tabs: **Issued**, **Stock**, **Records** and **Settings**.

### “Keys” page {#schluessel}

![The “Keys” page with the “Issued” tab: who holds which key, since when, with what deposit.](bild: seite=schluessel; tab=ausgegeben)

### “Issued” tab {#schluessel-ausgegeben}

One row per person: keys with their ID, since when (and “until”, if limited), deposit and status. On a phone the details are stacked as a card.

- **Status:** “Issued”, “Limited”, “Overdue” (return date has passed), “Left” (the member has left or is leaving) or “No record” (taken over from Member management).
- **Filters:** “All”, “Ask for return” (left or overdue), “Limited” and “With deposit”.
- **Notice at the top:** whoever has to return keys is listed in the box above the list – and on the admin Overview.
- **Excel:** issues, stock and a deposit list with a total (the deposit the club currently holds).

#### Issue keys {#ausgeben}

![The “Issue keys” window: person, keys, return, deposit, terms and where to sign.](bild: seite=schluessel; tab=ausgegeben; klick=#slNew; ziel=dialog)

1. **Recipient:** type the name (from two letters). With “Person without a Clubwerk account …” you enter first and last name and a contact (phone or email) instead. If the date of birth is known and the person is a minor, a signature from a parent or guardian is added.
2. **Issued by:** pre-filled with the logged-in user – can be changed, e.g. for the groundskeeper.
3. **Keys:** tick one or more types; Clubwerk takes one free unit of each type.
4. **Return by** (optional) and **deposit** (recorded in the record only as “received in cash”; Clubwerk does not post any money).
5. **Terms:** choose a template. The text is frozen when signed – later changes to the template never change old records.
6. **Where is it signed?** “Here on this device” (hand the device to the recipient) or “On the club tablet with a code”.

The window then shows the summary and terms. The person ticks “Read and agreed” and signs, and so does the person handing over the key. “Complete (binding)” creates the PDF record (number like “S-2026-014”, with a checksum) in the vault; if an email address is known, it is sent to the person. A completed record cannot be changed – if there is a mistake, cancel it and issue again.

**On the club tablet:** Clubwerk shows a 6-digit code (valid for 3 hours). The “Keys” tab appears on the tablet, the person enters the code, checks the details, reads the terms and both sign. Anyone entering a wrong code too often is locked out; you get a security warning. While something is waiting, the row appears in the list as “Waiting for signature” – with “Create new code” or “Discard handover”.

#### Return {#rueckgabe}

![The “Return” window: units, condition, deposit and the signature of the person accepting.](bild: seite=schluessel; tab=ausgegeben; klick=[data-ret]; ziel=dialog)

The “Return” button on the row opens the return record. You choose which units come back, the condition (fine or damaged, with a note) and – if a deposit was paid – whether it was paid back in cash, kept (with a reason) or not yet refunded. **The signature of the person accepting is required**, the returner’s is optional (keys often come back by post). The PDF is the receipt; the units are available again afterwards.

#### Report a loss {#verlust}

At the bottom of the “Return” window: “Report a loss …”. Date, circumstances, costs (none, received in cash or still open) and the signature of the person accepting. The unit then counts as “lost”. If the type is **security-relevant**, the board gets a red security warning (push and email), otherwise a yellow one.

#### Details {#einzelheiten}

The pencil on the row shows keys, deposit and all records of the issue with their PDF. Here you can **“Send reminder”** (email to the person), for taken-over numbers **“Catch up record”** (with signatures; the handover date stays) and – at the very bottom on its own line – **“Cancel issue …”**. A cancellation needs a reason, gets its own record and makes the units available again; the old record stays visible, struck through.

### “Stock” tab {#schluessel-bestand}

![The “Stock” tab: types with “2 of 6 in stock”, issued and lost units.](bild: seite=schluessel; tab=bestand)

One row per **type** (e.g. “No. 08 Clubhouse main entrance”, 10 units) with in stock, issued and lost.

![The window of a type: ID, name, kind, “Opens”, deposit, security-relevant and the units.](bild: seite=schluessel; tab=bestand; klick=[data-te]; ziel=dialog)

- **+ Type:** ID (e.g. 08 or T-14), name, kind (key, transponder/chip, card, other), “Opens” (free text), default deposit, number of units and a note.
- **Security-relevant:** tick for master keys and the main entrance – a loss triggers a red security warning.
- **Units:** in the type’s window you see each unit with its status. “Blocked” only records that a transponder was deactivated in another system (Clubwerk does not switch anything). “Retire” takes a unit out of stock. “Add units” creates new ones.
- **Delete** only works for types without records.

### “Records” tab {#schluessel-protokolle}

![The “Records” tab: number, kind, person and date with PDF.](bild: seite=schluessel; tab=protokolle)

All records (issue, return, loss, cancellation) with number, person, date and PDF. Cancelled issues are struck through.

### “Settings” tab {#schluessel-einstellungen}

#### Terms {#bedingungen}

![The “Terms” card with the templates.](bild: seite=schluessel; tab=einstellungen; ziel=[data-card="bedingungen"])

Several templates are possible (e.g. “Standard”, “Coaches and tenants”). Placeholders: `{Verein}`, `{Höchstbetrag}` and `{Frist}`. The text only applies to new issues. This is not legal advice – please agree it with the board.

#### Loss and retention {#aufbewahrung}

![The “Loss and retention” card.](bild: seite=schluessel; tab=einstellungen; ziel=[data-card="verlust"])

The “maximum amount on loss” appears in the terms. Current issues are always kept. After that, record, signatures and PDF are deleted together: without deposit after 36 months (3 years), with deposit or costs after 120 months (10 years) – adjustable from 12 to 120 months, also under Settings › Data protection.

#### Email {#email}

The record is sent to the person as a PDF if their address is known (for members from Member management, otherwise from the contact field). Optionally a copy to a fixed address (e.g. the board). Without a configured mailbox (Settings › Mailbox) you can still download or print it.

#### Transfer settings {#uebertragen}

Export and import only contain types, templates and settings – never people, issues or signatures.

## Tablet and app {#tablet-app}

**Tablet:** the “Keys” tab only appears while a handover with a code is waiting for a signature. Enter the code, check the handover, read the terms, tick “Read and agreed”, both sign, “Complete (binding)”. After 4 minutes without input the tablet returns to the start by itself.

**App:** members see nothing of this module in the member app. Their record arrives by email.

## Rights {#rechte}

| Right | What it allows |
|---|---|
| Keys | Stock, issue, return, loss, records (PDF and signatures), settings and Excel. |

## Working with other modules {#zusammenspiel}

- **Member management:** the records appear in the member’s “Documents” tab (no copy). The leaving window says “Still has key …”. A member with an issued key cannot be deleted permanently. The “key number” field is replaced by a note.
- **Admin Overview:** a notice about who has to return keys.
- **Security warnings:** losses and wrong codes on the tablet are reported there.
- **Data protection:** retention periods, data access and the record of processing activities (Settings › Data protection).
