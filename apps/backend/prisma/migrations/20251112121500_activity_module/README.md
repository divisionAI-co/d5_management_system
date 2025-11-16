## Activity Module Migration

- Replaces the `ActivityType` enum with a new `activity_types` table to allow managing types dynamically from settings.
- Extends the `activities` table with richer metadata (subjects, body, reminder fields, assignment, visibility).
- The migration maps existing activity records to the new schema, preserving historical data.


