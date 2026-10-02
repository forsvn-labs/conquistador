# crm.read

Read contacts, companies, deals, pipeline stages, and activity history.

## Answers

- Which segments win, lose, or stall, and at which stage?
- Who are the accounts and contacts for an outbound or expansion list?
- What objections and reasons appear in lost deals?

## Find the tool

Search phrases: `search crm contacts`, `list deals pipeline`, `get company record`.

Filter on the server side. Request only the properties you need. Do not copy personal data
into project files.

## Providers

| Provider | Search for | Needs |
| --- | --- | --- |
| HubSpot | `crm objects search` (contacts, companies, deals) | Object type, filter groups, property names |
| Salesforce | `query` (SOQL) | SOQL with `LIMIT`; object and field API names |
| Attio | `records query` | Object slug (`people`, `companies`, `deals`), filter |
| Pipedrive | `deals list`, `persons search` | Filter ID or search term |
| Close, Copper, Folk | `leads search`, `opportunities list` | Search term or status |
