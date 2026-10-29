# Bookmark Manager

Password-protected, accountless bookmarking and resource-curation platform.

- Users Submit urls and they are auto categorized in a collection

* Password-based access control: a password grants access to a collection.
* Passwordless-account architecture: users can use the app without registering accounts. This doesn't mean access itself is passwordless.
* Capability-based access (related concept): a secret token grants specific permissions to a resource, such as editing one collection.
* Multi-tenant resource model (loosely): collections act as separate ownership and authorization boundaries, even without registered users.

- PostgreSQL + Prisma + React + TS

## Database

### Collections

- The resource group and its ownership boundary.

| Field             | Type              | Description                              |
| ----------------- | ----------------- | ---------------------------------------- |
| id                | UUID              | Unique collection identifier             |
| name              | String (optional) | Collection name                          |
| owner_secret_hash | String            | Hash of the management password          |
| visibility        | Enum              | public or private                        |
| created_at        | Timestamp         | Date and time the collection was created |

- Relationship: One collection contains many resources.

### Content

- Individual URLs and their associated metadata.

| Field         | Type            | Description                           |
| ------------- | --------------- | ------------------------------------- |
| id            | UUID            | Unique content identifier             |
| collection_id | UUID (FK)       | References Collections.id             |
| url           | String          | Submitted URL                         |
| title         | String          | Extracted or generated title          |
| metadata      | JSON (optional) | Additional metadata                   |
| created_at    | Timestamp       | Date and time the content was created |

- Relationship: Each content item belongs to one collection.

### CollectionSessions

- Temporary management access for multiple editors or sessions.

| Field         | Type      | Description                           |
| ------------- | --------- | ------------------------------------- |
| id            | UUID      | Unique session identifier             |
| collection_id | UUID (FK) | References Collections.id             |
| token_hash    | String    | Hash of the session token             |
| expires_at    | Timestamp | Session expiration date and time      |
| created_at    | Timestamp | Date and time the session was created |

- Relationship: One collection can have multiple management sessions.
