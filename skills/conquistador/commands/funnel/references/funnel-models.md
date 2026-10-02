# Define stages from observable events

A useful funnel model describes a specific population moving through measurable events over a stated period. Choose stages from the business process and available records. Do not choose a named framework first and force the data into it.

## Define the population

State whether the unit is a person, account, order, organization, or task. Identify the eligible population and observation window. Record identity joins, duplicate handling, and exclusions. Never multiply person-level and account-level rates without an explicit mapping.

## Trace the process

List the actual steps between the starting event and the business outcome. Include review or approval steps that delay progress. Define entry and completion events for each stage, the source field or query, the owner, and expected delay.

A stage must answer a useful decision. Merge indistinguishable stages when the records cannot separate them. Keep unobserved stages labeled unknown rather than allocating a guessed percentage.

## Handle different paths

Self-service and sales-assisted paths can share an outcome while having different starting events and delays. Model each path separately before combining totals. Define how people who change paths are counted once.

For a recurring product, define the return opportunity and eligible cohort before measuring repeat use or renewal. For one-time purchases, fulfillment and returns may matter more than repeat visits. For marketplaces, model the participants and transaction match explicitly; a single linear visitor-to-purchase path may hide a missing side.

## Calculate transitions

For adjacent stages with a compatible cohort and window, divide the number completing the later event by the number eligible at the earlier event. Show numerator, denominator, exclusions, and period beside the rate. A zero denominator produces an unavailable rate, not zero conversion.

Only multiply transition rates when the cohorts and observation rules are compatible. If completion can occur after the window, show pending cases separately. Separate a forecast from observed totals.

## Map initiatives

Map each proposed initiative to the event or delay it is intended to change. Name the mechanism, expected direction, and evidence supporting any proposed magnitude. If the initiative affects several stages, identify the primary effect and interactions to prevent double-counting.

An initiative without a measurable link remains unmapped with an explanation. Do not invent a target to complete the table. Target-setting follows baseline verification.

## Output contract

Return business profile, population, stage definitions, event sources, initiative mapping, unknowns, and model limitations. Use descriptive stage names that correspond to real events. Keep the user's existing labels when they map accurately to the definitions.

## Synthetic examples

For a trial product, the observable path may be permitted account creation, completion of a representative task, and an accepted paid subscription. Count repeat task use separately over its actual use interval. A trial sign-up is not a completed task or paid customer.

For a sales-assisted service, the path may be an eligible inquiry, completed qualification, accepted scope, and a signed agreement. State which records distinguish a proposed agreement from an accepted one. Payment and delivery can be separate downstream events.

For physical goods, a placed order and a retained sale differ when cancellations or returns occur. Model the period required to observe returns rather than immediately treating all orders as realized contribution.

These examples are synthetic definitions, not conversion benchmarks or claims of live execution.
