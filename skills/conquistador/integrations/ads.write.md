# ads.write

Create, change, pause, or fund ad campaigns, ad sets, ads, and budgets.

This is spend. Show the account, the objects, the exact change, and the budget effect. Get the
user's explicit approval for each call. Create new objects in a paused state. Never raise a
budget or start delivery without that approval.

## Find the tool

Search phrases: `create ad campaign`, `update ad budget`, `pause ad set`.

## Providers

| Provider | Search for | Needs |
| --- | --- | --- |
| Meta Ads | `campaigns create`, `adsets update` | Ad account ID; `status: PAUSED` on create |
| Google Ads | `campaigns mutate`, `campaignBudgets mutate` | Customer ID; validate-only mode first when offered |
| LinkedIn Ads | `adCampaigns create` | Ad account URN; draft status |
| TikTok Ads | `campaign create`, `adgroup update` | Advertiser ID |
