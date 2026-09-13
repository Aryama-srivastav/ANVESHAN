# Offline Client

Planned field workflow for acquiring evidence without network access:

```text
Acquire -> Encrypt locally -> Hash and seal -> Queue -> Sync -> Verify centrally
```

The client must preserve acquisition time, device/session context, hashes, and custody events across synchronization.