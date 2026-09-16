# Evidence Engine

Owns evidence integrity and provenance operations:

- SHA-256 hashing and verification
- sealing and immutable source records
- custody events
- parent/derived evidence relationships
- integrity status calculation

This module should expose domain services that the backend can call without knowing storage or cryptography implementation details.