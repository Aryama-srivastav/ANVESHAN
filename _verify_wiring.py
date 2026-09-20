"""One-off verification of the UI-gap feature wiring (safe to delete)."""
from pathlib import Path

root = Path(__file__).resolve().parent
app = (root / "frontend/src/App.tsx").read_text(encoding="utf-8")
panels = (root / "frontend/src/panels.tsx").read_text(encoding="utf-8")
api = (root / "frontend/src/api.js").read_text(encoding="utf-8")

checks = {
    "App.tsx imports DepartmentsView": "DepartmentsView" in app,
    "App.tsx 'departments' view type": '"departments"' in app,
    "App.tsx departments route": 'activeView === "departments"' in app,
    "App.tsx Departments nav item": 'label="Departments"' in app,
    "App.tsx mode selector (prototype/officer/viewer)": 'PROTOTYPE' not in app and '"officer"' in app and '"viewer"' in app,
    "App.tsx MFA challenge form": "MFA CHALLENGE" in app,
    "App.tsx viewer OTP register": "REGISTER & SEND CODE" in app,
    "App.tsx viewer OTP verify": "VERIFY & ENTER VAULT" in app,
    "panels.tsx exports DepartmentsView": "export function DepartmentsView" in panels,
    "panels.tsx tags + ML section": "TAGS & ML CLASSIFICATION" in panels,
    "panels.tsx lineage section": "LINEAGE VERIFICATION" in panels,
    "panels.tsx status pill helper": "function StatusPill" in panels,
    "api.js lineage endpoint": "getDocumentLineage" in api,
    "api.js dept request list": "listDepartmentRequests" in api,
    "api.js dept request create": "createDepartmentRequest" in api,
    "api.js dept request action": "actionDepartmentRequest" in api,
}

failed = [name for name, ok in checks.items() if not ok]
for name, ok in checks.items():
    print(f"{'PASS' if ok else 'FAIL'}  {name}")
print()
print("ALL CHECKS PASSED" if not failed else f"FAILURES: {failed}")
