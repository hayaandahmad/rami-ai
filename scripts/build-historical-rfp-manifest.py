#!/usr/bin/env python3
"""Build resources/historical-rfps/manifest.json from audit + source files."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path("resources/historical-rfps")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


DATASETS = [
    {
        "id": "rfp-22-egovt-2026-reengineering-ofa",
        "name": "Open Framework Agreement for Reengineering Projects (22/eGovt/2026)",
        "excel": "Rami_Reengineering_Framework_22_eGovt_2026_Question_Bank_Answers.xlsx",
        "pdf": "framework-agreement-reengineering-rfp-22egovt2026.pdf",
        "pdfNote": "Explicitly supplied with dataset",
        "documentKinds": ["framework_agreement", "consulting", "bpr"],
    },
    {
        "id": "pq-15-egovt-2026-sanad-ai",
        "name": "Agentic Chatbot (SANAD AI) Pre-Qualification (15/eGovt/2026)",
        "excel": "Rami_SANAD_AI_PQ_Question_Bank_Answers.xlsx",
        "pdf": "agentic-chatbot-sanad-ai-pq-v2.pdf",
        "pdfNote": "Explicitly supplied with dataset",
        "documentKinds": ["pre_qualification", "ai_system"],
    },
    {
        "id": "rfp-ssc-bpr",
        "name": "SSC Business Process Reengineering",
        "excel": "Rami_SSC_BPR_Question_Bank_Answers.xlsx",
        "pdf": None,
        "pdfNote": "Source PDF not provided in this batch",
        "documentKinds": ["consulting", "bpr"],
    },
    {
        "id": "rfp-nur-v2-lakehouse",
        "name": "NUR V2 Lakehouse",
        "excel": "Rami_NUR_V2_Lakehouse_Question_Bank_Answers.xlsx",
        "pdf": None,
        "pdfNote": "Source PDF not provided in this batch",
        "documentKinds": ["system_implementation", "data_platform"],
    },
    {
        "id": "rfp-itas-vol2b",
        "name": "ITAS Volume 2B — Integrated Tax Administration Solution",
        "excel": "Rami_ITAS_Vol2B_Question_Bank_Answers.xlsx",
        "pdf": "modee-stage3-rfp-vol2b-itas-vf.pdf",
        "pdfNote": "Corresponding PDF found adjacent in Downloads; included as source artifact",
        "documentKinds": ["system_implementation", "tax"],
    },
    {
        "id": "rfp-connectivity-ofa",
        "name": "Internet & Connectivity Open Framework Agreement",
        "excel": "Rami_Connectivity_OFA_Question_Bank_Answers.xlsx",
        "pdf": None,
        "pdfNote": "Source PDF not provided in this batch",
        "documentKinds": ["framework_agreement", "connectivity"],
    },
    {
        "id": "rfp-17-egovt-2026-performance-assessment",
        "name": "Open Framework Agreement for Performance Assessment (17/eGovt/2026)",
        "excel": "Rami_RFP_17_eGovt_2026_Question_Bank_Answers.xlsx",
        "pdf": "rfp-document-17egovt2026.pdf",
        "pdfNote": "Corresponding PDF found adjacent in Downloads; included as source artifact",
        "documentKinds": ["framework_agreement", "performance_assessment"],
    },
]


def main() -> None:
    audit = json.loads((ROOT / "derived" / "audit-raw.json").read_text(encoding="utf-8"))
    by_file = {d["file"]: d for d in audit["datasets"]}
    resources = []
    for d in DATASETS:
        a = by_file[d["excel"]]
        excel_path = ROOT / "source" / "excel" / d["excel"]
        entry = {
            "id": d["id"],
            "name": d["name"],
            "sourceType": "historical_rfp_question_bank_extraction",
            "notCurrentProjectData": True,
            "notTrainingData": True,
            "notRagIngested": True,
            "intendedUse": ["REFERENCE", "EVALUATION", "RAG_CANDIDATE"],
            "documentKinds": d["documentKinds"],
            "excel": {
                "path": f"source/excel/{d['excel']}",
                "bytes": excel_path.stat().st_size,
                "sha256": sha256(excel_path),
                "sheets": a["sheetNames"],
                "qaSchema": "Section|Question ID|Exact Rami Question|Answer Based on RFP|Status|Source (RFP)",
                "canonicalQuestionsMatched": a["matchedCount"],
                "canonicalQuestionsExpected": a["canonicalExpected"],
                "answeredCanonical": a["answeredCanonicalCount"],
                "statusCounts": a["statusCounts"],
                "rowsWithSourceReference": a["rowsWithSource"],
                "fieldsStrongCount": len(a["fieldsStrong"]),
                "fieldsPartialCount": len(a["fieldsPartial"]),
                "suggestedAdditionIds": a["suggestedAdditionIds"],
                "extractionStatus": "complete_question_bank_pass",
                "sourceTraceability": (
                    "page_refs_present"
                    if a["rowsWithSource"] == a["qaRowCount"]
                    else "partial"
                ),
            },
            "pdf": None,
            "notes": [],
        }
        if d["pdf"]:
            pdf_path = ROOT / "source" / "pdf" / d["pdf"]
            entry["pdf"] = {
                "path": f"source/pdf/{d['pdf']}",
                "bytes": pdf_path.stat().st_size,
                "sha256": sha256(pdf_path),
                "originalFilenameNote": d["pdfNote"],
            }
        else:
            entry["notes"].append(d["pdfNote"])
        if a["statusCounts"].get("TBC", 0) >= 10:
            entry["notes"].append(
                "High TBC count — strong PQ/deferred-stage evaluation candidate"
            )
        if "Final Rami Architecture" in a["sheetNames"]:
            entry["notes"].append(
                "Includes Final Rami Architecture sheet (adaptive design notes)"
            )
        resources.append(entry)

    source_bytes = sum(p.stat().st_size for p in (ROOT / "source").rglob("*") if p.is_file())
    manifest = {
        "schemaVersion": 1,
        "library": "historical-rfps",
        "description": (
            "Historical MoDEE/government RFP Question Bank extractions and optional "
            "source PDFs. REFERENCE only — never current ProjectFacts."
        ),
        "semantics": {
            "source": "Immutable supplied Excel/PDF artifacts under source/",
            "derived": "Machine-generated audits/normalized datasets under derived/ only",
            "forbidden": [
                "CURRENT_PROJECT_DATA",
                "silent ProjectFacts import",
                "training corpus without explicit approval",
            ],
        },
        "canonicalRamiTargets": {
            "questionBankCount": 62,
            "fieldCount": 52,
            "sectionCount": 20,
        },
        "totals": {
            "datasetCount": len(resources),
            "excelCount": len(resources),
            "pdfCount": sum(1 for r in resources if r["pdf"]),
            "sourceBytes": source_bytes,
        },
        "resources": resources,
        "audit": {
            "rawPath": "derived/audit-raw.json",
            "summaryPath": "derived/AUDIT_SUMMARY.md",
            "generatedBy": "scripts/audit-historical-rfp-resources.py",
        },
    }
    out = ROOT / "manifest.json"
    out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {out} datasets={len(resources)} sourceBytes={source_bytes}")


if __name__ == "__main__":
    main()
