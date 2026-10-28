# Data Model

This is an initial relational design. Adjust it as the product is implemented; do not over-engineer for future graph features.

## Tables

### users
- `id` UUID primary key (align with auth provider user ID where appropriate)
- `username` unique, required
- `display_name`
- `bio`
- `created_at`
- `updated_at`

### films
- `id` UUID primary key
- `provider` (e.g. `tmdb`)
- `provider_film_id` text
- `title` required
- `release_year` nullable
- `director` nullable
- `poster_path` nullable; store provider reference rather than copying artwork unnecessarily
- `metadata_attribution` nullable
- `created_at`
- Unique constraint on `(provider, provider_film_id)`

### interpretations
- `id` UUID primary key
- `film_id` FK to films
- `author_id` FK to users
- `title` required
- `claim` required
- `interpretation_type` enum: `interpretation`, `fan_theory`, `production_fact`, `question`
- `spoiler_level` enum: `none`, `minor`, `major`
- `status` enum: `published`, `hidden`, `removed`
- `created_at`, `updated_at`

### evidence
- `id` UUID primary key
- `interpretation_id` nullable FK
- `counter_reading_id` nullable FK
- Exactly one of these parent references must be non-null.
- `scene_description` nullable
- `timestamp_seconds` nullable integer, non-negative
- `evidence_type` enum: `observation`, `external_source`, `production_fact`
- `description` required
- `source_url` nullable
- `created_at`

### counter_readings
- `id` UUID primary key
- `interpretation_id` FK
- `author_id` FK
- `body` required
- `status` enum: `published`, `hidden`, `removed`
- `created_at`, `updated_at`

### tags
- `id` UUID primary key
- `name` unique
- `category` enum or controlled text: `motif`, `cinematography`, `editing`, `sound`, `narrative`, `theme`, `genre`, `other`

### interpretation_tags
- `interpretation_id` FK
- `tag_id` FK
- Composite primary key `(interpretation_id, tag_id)`

### reports
- `id` UUID primary key
- `reporter_id` FK
- `target_type` enum: `interpretation`, `counter_reading`, `evidence`, `reply`, `user`
- `target_id` UUID (application-level polymorphic reference; validate target existence)
- `reason` controlled value
- `details` nullable
- `status` enum: `open`, `reviewing`, `dismissed`, `actioned`
- `created_at`, `resolved_at` nullable

### replies (optional for MVP)
- `id` UUID primary key
- `interpretation_id` FK
- `counter_reading_id` nullable FK
- `author_id` FK
- `body` required
- `created_at`, `updated_at`

## Key constraints
- Use foreign keys and indexes for all common lookups.
- Add index on `interpretations(film_id, status, created_at)`.
- Add index on `counter_readings(interpretation_id, status, created_at)`.
- Add full-text search index for interpretation title and claim once needed.
- Enforce one-parent-only rule for evidence with a database CHECK constraint.
- Prevent users from editing other users' content unless moderator/admin.
- Consider soft removal for moderation; preserve an audit trail for moderator actions.

## Future graph relationships
Do not add graph infrastructure initially. Later, motif-to-scene and interpretation-to-interpretation links can be represented using join tables such as `motif_occurrences` and `interpretation_links`.
