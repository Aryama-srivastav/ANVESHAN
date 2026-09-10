# ANVESHAN

### Secure Evidence Intelligence & Investigation Platform

> **Reconstruct the Evidence. Trace the Truth.**

ANVESHAN is a secure, provenance-aware digital evidence and investigation platform designed for law-enforcement agencies to manage sensitive legal and investigation records throughout their lifecycle.

Unlike a conventional Document Management System, ANVESHAN treats evidence as a connected, traceable object rather than simply a file stored inside a folder.

The platform combines **cryptographic integrity, evidence provenance, chain of custody, evidence derivation tracking, investigation intelligence, secure access control, offline evidence acquisition, and grounded AI assistance** into a unified investigation workflow.

---

## 🎯 Problem

Law-enforcement investigations involve FIRs, police reports, witness statements, charge sheets, forensic reports, CCTV footage, photographs, audio/video recordings, legal documents and other sensitive records.

Traditional document-centric systems can make it difficult to answer critical questions:

* Where did this evidence originate?
* Who handled it and when?
* Has it ever been modified?
* What evidence was derived from the original?
* Which documents support a particular claim?
* What happened during the investigation?
* Are different statements or records contradictory?
* Who accessed sensitive evidence and for what purpose?
* Can evidence be securely transferred between agencies?

ANVESHAN addresses these challenges by building an **evidence-centric investigation infrastructure**.

---

## 💡 Our Approach

Instead of:

```text
User → Folder → Document
```

ANVESHAN models an investigation as:

```text
Case
 │
 ├── Evidence
 │    ├── Source
 │    ├── Custody Events
 │    ├── Derived Evidence
 │    ├── Metadata
 │    └── Integrity Status
 │
 ├── Documents
 ├── Persons / Entities
 ├── Events
 └── Investigation Timeline
```

Every important action becomes part of the evidence's traceable history.

---

## ⭐ Core Capabilities

### 1. Case Evidence Object

A unified digital representation of an investigation evidence item containing:

* Evidence ID
* Case ID
* Source information
* Acquisition metadata
* Cryptographic hash
* Digital signature information
* Custody history
* Access history
* Parent/derived evidence relationships
* Integrity status

---

### 2. Evidence Provenance Graph

ANVESHAN maintains relationships between original evidence and everything derived from it.

Example:

```text
CCTV Video
     │
     ├── Forensic Copy
     │       │
     │       ├── Extracted Frame
     │       │       └── AI Detection
     │       │
     │       └── Audio Extraction
     │               └── Transcript
     │
     └── Investigation Report
```

Investigators can trace a claim or derived artifact back to its original source.

---

### 3. Cryptographic Chain of Custody

Every important evidence event is cryptographically linked.

```text
Evidence Acquired
       ↓
Hash Generated
       ↓
Evidence Sealed
       ↓
Transferred
       ↓
Accessed
       ↓
Derived
       ↓
Reviewed
       ↓
Presented
```

Each event records relevant information such as:

* Actor
* Timestamp
* Action
* Evidence ID
* Previous event hash
* Current evidence hash
* Device/session information

This makes unauthorized modification or deletion of historical events detectable.

---

### 4. Evidence Derivation Tracking

Original evidence is never overwritten.

If an investigator creates:

```text
Original Video
      ↓
Extracted Frame
      ↓
Annotated Frame
      ↓
Investigation Report
```

ANVESHAN preserves the parent-child relationship between every artifact.

---

### 5. Automatic Case Timeline Reconstruction

ANVESHAN can extract relevant dates, timestamps, entities and events from investigation records and organize them into a chronological case timeline.

Each timeline event remains linked to its supporting evidence.

```text
10:32 PM ─ CCTV Event
10:41 PM ─ Witness Statement
10:47 PM ─ Police Report
11:03 PM ─ Evidence Acquisition
11:26 PM ─ Forensic Analysis
```

---

### 6. Contradiction Detection

The system can identify potentially conflicting information across investigation documents.

For example:

```text
Witness Statement:
Incident occurred at 21:30

CCTV Metadata:
Relevant event detected at 21:47

Police Report:
Incident recorded at 21:35
```

ANVESHAN flags the inconsistency for investigator review.

It does **not** automatically determine which statement is true.

---

### 7. Evidence-Aware AI

ANVESHAN provides AI-assisted investigation capabilities while keeping evidence as the source of truth.

The AI can assist with:

* Case summarization
* Document understanding
* Entity extraction
* Timeline generation
* Evidence discovery
* Relationship analysis
* Contradiction identification
* Natural-language investigation queries

Every factual AI response should be traceable to supporting evidence.

```text
Investigator:
"What evidence places Person X near the location?"

ANVESHAN AI:
"Evidence found in 3 records."

[Evidence #E-102]
CCTV — 21:47 — Frame 3821

[Evidence #E-117]
Witness Statement — Page 4

[Evidence #E-129]
Location Record — 21:52
```

If sufficient evidence is unavailable, the system should abstain rather than fabricate an answer.

---

### 8. Purpose-Bound Access

Access control goes beyond simple role-based permissions.

Access decisions can consider:

```text
WHO
+
WHAT
+
WHICH CASE
+
WHY
+
WHEN
+
WHERE
+
DEVICE TRUST
+
EVIDENCE SENSITIVITY
```

This enables context-aware access to sensitive investigation material.

---

### 9. Offline Evidence Vault

Field investigators may need to acquire evidence when network connectivity is unavailable.

ANVESHAN supports a controlled offline workflow:

```text
Field Device
     ↓
Encrypted Local Vault
     ↓
Cryptographic Sealing
     ↓
Offline Queue
     ↓
Network Restored
     ↓
Secure Synchronization
     ↓
Central Repository
```

The evidence's integrity and custody history begin at acquisition rather than when the device reconnects.

---

### 10. Secure Inter-Agency Evidence Exchange

ANVESHAN can package evidence for controlled transfer between authorized agencies.

A transfer package can contain:

* Encrypted evidence
* Evidence manifest
* Cryptographic hash
* Digital signature
* Custody history
* Authorization information
* Recipient information
* Transfer timestamp

The receiving agency verifies the package before accepting it into its evidence repository.

---

### 11. Evidence Integrity Score

Each evidence item receives a transparent integrity status based on verifiable checks.

Example:

```text
EVIDENCE INTEGRITY
────────────────────────────

✓ Original Hash Verified
✓ Custody Chain Complete
✓ Signature Valid
✓ No Unauthorized Modification
✓ Metadata Consistent
✓ Provenance Available
✓ Derivatives Accounted For

STATUS: VERIFIED
```

Potential issues can be surfaced as:

```text
⚠ Metadata Discrepancy
⚠ Custody Gap
⚠ Unsigned Transfer
⚠ Integrity Verification Required
```

The score is intended to improve visibility, not replace human/legal judgment.

---

## 🏗️ High-Level Architecture

```text
                    ┌──────────────────────┐
                    │   Investigator UI    │
                    │  Web / Field Client  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   API / Gateway      │
                    └──────────┬───────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
 ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
 │ Access Control │   │ Evidence       │   │ Investigation  │
 │ & Security     │   │ Management     │   │ Intelligence   │
 └────────────────┘   └────────────────┘   └────────────────┘
          │                    │                    │
          │                    ▼                    ▼
          │           ┌────────────────┐   ┌────────────────┐
          │           │ Provenance &   │   │ AI / Search /  │
          │           │ Custody Engine  │   │ Analytics      │
          │           └────────────────┘   └────────────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │ Evidence Repository  │
                    │ + Metadata Database  │
                    └──────────────────────┘
```

---

## 🔐 Security Principles

ANVESHAN follows a security-first design philosophy.

Key principles include:

* Least-privilege access
* Role-based and attribute-based authorization
* Purpose-bound access
* Multi-factor authentication
* Encryption in transit
* Encryption at rest
* Cryptographic hashing
* Digital signatures
* Append-only audit records
* Tamper detection
* Secure session management
* Device-aware access
* Evidence immutability
* Controlled data sharing

---

## 🧠 Technology Direction

The implementation may use technologies across the following layers:

| Layer            | Technologies                                 |
| ---------------- | -------------------------------------------- |
| Frontend         | React / Next.js                              |
| Backend          | FastAPI / Python                             |
| Database         | PostgreSQL                                   |
| Object Storage   | S3-compatible storage                        |
| Search           | OpenSearch / Elasticsearch                   |
| Vector Search    | pgvector / vector database                   |
| AI/ML            | Python, Transformers, OCR, LLM               |
| Authentication   | OAuth2 / OpenID Connect / JWT                |
| Cryptography     | SHA-256, digital signatures                  |
| Containerization | Docker                                       |
| Deployment       | Cloud / Government-compatible infrastructure |

Technology choices may evolve during implementation.

---

## 📂 Repository Structure

```text
anveshan/
│
├── frontend/
│
├── backend/
│
├── ai/
│
├── security/
│
├── database/
│
├── evidence-engine/
│
├── search/
│
├── offline-client/
│
├── docs/
│
├── tests/
│
├── demo-data/
│
├── .gitignore
├── LICENSE
├── README.md
└── docker-compose.yml
```

---

## 🎬 Demonstration Scenarios

### Scenario 1 — "Can You Prove This Evidence Wasn't Altered?"

1. Investigator uploads CCTV footage.
2. ANVESHAN generates its cryptographic hash.
3. Evidence is sealed.
4. Custody events begin.
5. A derived frame is generated.
6. The original remains immutable.
7. Investigator verifies the complete provenance chain.

**Judge takeaway:**
The system does not merely store evidence; it can demonstrate its history.

---

### Scenario 2 — "Find the Contradiction"

1. Upload witness statement.
2. Upload police report.
3. Upload CCTV metadata.
4. ANVESHAN extracts events.
5. Timeline is reconstructed.
6. Contradictory timestamps are detected.
7. Investigator opens the original supporting records.

**Judge takeaway:**
AI assists investigation without replacing investigator judgment.

---

### Scenario 3 — "Follow the Evidence"

1. Investigator asks an investigation question.
2. AI searches the case knowledge space.
3. Relevant evidence is retrieved.
4. Relationships are traversed.
5. AI generates a grounded response.
6. Every claim links back to evidence.
7. Investigator traces the answer to the original artifact.

**Judge takeaway:**
The AI is evidence-grounded and explainable.

---

## 🚫 Deliberately Out of Scope

To keep the system reliable and achievable, ANVESHAN does not attempt to build:

1. A complete national criminal justice information system.
2. An autonomous system that determines guilt or innocence.
3. Facial recognition as the primary product.
4. A fully autonomous investigative decision-maker.
5. A replacement for existing government case-management infrastructure.

ANVESHAN is designed as an **evidence integrity and investigation intelligence layer**, not as a replacement for every existing law-enforcement system.

---

## 🧪 Development Philosophy

The project prioritizes:

**Integrity > Intelligence**

AI capabilities are valuable only when the underlying evidence is trustworthy and traceable.

Therefore:

```text
Evidence
   ↓
Integrity
   ↓
Provenance
   ↓
Retrieval
   ↓
Intelligence
   ↓
Human Decision
```

The system assists investigators; it does not make legal decisions on their behalf.

---

## ⚠️ Security & Privacy Notice

This repository is intended for development, demonstration and research purposes.

**Never commit:**

* Real investigation records
* Personally identifiable information
* Real victim/witness information
* Real evidence
* Passwords
* API keys
* Private keys
* Certificates
* Production credentials
* Government confidential information

Use synthetic or anonymized data for development and demonstrations.

---

## 📜 License

This project is licensed under the **Apache License 2.0**.

See [`LICENSE`](LICENSE) for details.

---

## 🚧 Project Status

**Status: Active Development**

ANVESHAN is being developed as a prototype aligned with the Smart India Hackathon 2026 problem statement:

**SIH26190 — Secure Digital Document Management System for Legal and Investigation Documents**

The implementation, architecture and technology choices may evolve during development.

---

## 👥 Team

**Team:** Zynora

Developed for **Smart India Hackathon 2026**

---

## 🏛️ Vision

ANVESHAN aims to move investigation records from:

```text
Files → Folders → Documents
```

towards:

```text
Evidence → Provenance → Relationships → Intelligence → Traceable Decisions
```

> **ANVESHAN**
>
> **Reconstruct the Evidence. Trace the Truth.**
