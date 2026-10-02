# crm.write

Create or update contacts, companies, deals, notes, and tasks in the CRM.

This is a write. Show the exact payload and the target records, then get the user's explicit
approval for each call. Prefer a note or a task over a field change. Never bulk-update without a
reviewed list.

## Answers

- Log the outreach plan as tasks on the right contacts.
- Move a deal to the stage the user confirmed.

## Find the tool

Search phrases: `create crm contact`, `update deal stage`, `add note to contact`.

## Providers

| Provider | Search for | Needs |
| --- | --- | --- |
| HubSpot | `crm objects create`, `update`, `notes create` | Object type, properties, associations |
| Salesforce | `sobject create`, `update` | Object API name, record ID, fields |
| Attio | `records create`, `assert`, `notes create` | Object slug, matching attribute |
| Pipedrive | `deals update`, `activities add` | Deal or person ID |
