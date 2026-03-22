"""
Moss Medical Knowledge Indexer
================================
Run this script ONCE (or whenever you update your medical documents) to
build the semantic search index that the AI doctor uses for evidence-based
responses.

Usage:
    python index_knowledge.py

What it does:
  1. Reads .txt / .pdf files from the `knowledge/` directory.
  2. Splits them into overlapping chunks.
  3. Upserts all chunks into a Moss index called MOSS_INDEX_NAME.
  4. Triggers an index build and waits for completion.

Add your own medical PDFs / text files to knowledge/ before running.
Suggested sources:
  - WHO clinical guidelines
  - CDC symptom fact sheets
  - Common drug monographs (public-domain)
  - First-aid / triage protocols
"""

import asyncio
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")
logger = logging.getLogger("indexer")

KNOWLEDGE_DIR = Path(__file__).parent / "knowledge"
CHUNK_SIZE = 500       # characters per chunk
CHUNK_OVERLAP = 100    # overlap between consecutive chunks


def _chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks."""
    chunks, start = [], 0
    while start < len(text):
        end = start + size
        chunks.append(text[start:end].strip())
        start += size - overlap
    return [c for c in chunks if c]


def _load_documents() -> list[dict]:
    """Load all .txt and .pdf files from the knowledge directory."""
    documents = []

    if not KNOWLEDGE_DIR.exists():
        logger.warning(
            "Knowledge directory '%s' not found. Creating it.\n"
            "Add .txt or .pdf medical documents and re-run.",
            KNOWLEDGE_DIR,
        )
        KNOWLEDGE_DIR.mkdir(parents=True)
        return documents

    for path in KNOWLEDGE_DIR.rglob("*"):
        if path.suffix == ".txt":
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
                for i, chunk in enumerate(_chunk_text(text)):
                    documents.append(
                        {
                            "id": f"{path.stem}_chunk_{i}",
                            "text": chunk,
                            "metadata": {"source": path.name, "chunk": i},
                        }
                    )
                logger.info("Loaded '%s' → %d chunks", path.name, i + 1)
            except Exception as e:
                logger.error("Failed to read '%s': %s", path, e)

        elif path.suffix == ".pdf":
            try:
                import pypdf  # pip install pypdf

                reader = pypdf.PdfReader(str(path))
                full_text = "\n".join(
                    page.extract_text() or "" for page in reader.pages
                )
                for i, chunk in enumerate(_chunk_text(full_text)):
                    documents.append(
                        {
                            "id": f"{path.stem}_chunk_{i}",
                            "text": chunk,
                            "metadata": {"source": path.name, "chunk": i},
                        }
                    )
                logger.info("Loaded '%s' → %d chunks", path.name, i + 1)
            except ImportError:
                logger.error("pypdf not installed. Run: pip install pypdf")
            except Exception as e:
                logger.error("Failed to read '%s': %s", path, e)

    return documents


async def main() -> None:
    from inferedge_moss import MossClient

    project_id = os.environ["MOSS_PROJECT_ID"]
    project_key = os.environ["MOSS_PROJECT_KEY"]
    index_name = os.environ.get("MOSS_INDEX_NAME", "medical_knowledge")

    client = MossClient(project_id, project_key)

    # ── Ensure index exists (create it if not) ────────────────────────────────
    logger.info("Checking / creating Moss index '%s' …", index_name)
    try:
        existing = await client.list_indexes()
        names = [getattr(idx, "name", idx) for idx in (existing or [])]
        if index_name not in names:
            logger.info("Index not found – creating '%s' …", index_name)
            await client.create_index(index_name)
            logger.info("Index '%s' created.", index_name)
        else:
            logger.info("Index '%s' already exists.", index_name)
    except Exception as e:
        # Some Moss versions auto-create on first add_documents – try anyway
        logger.warning("Could not list/create index (will attempt add anyway): %s", e)

    # ── Load documents ────────────────────────────────────────────────────────
    documents = _load_documents()
    if not documents:
        logger.warning(
            "No documents loaded from '%s'.\n"
            "Add .txt or .pdf medical files there, then re-run this script.\n"
            "The agent will work WITHOUT RAG until the index is populated.",
            KNOWLEDGE_DIR,
        )
        return

    logger.info("Upserting %d document chunks into index '%s' …", len(documents), index_name)

    # Upsert in batches of 100
    batch_size = 100
    for i in range(0, len(documents), batch_size):
        batch = documents[i : i + batch_size]
        await client.add_documents(index_name, batch)
        logger.info("  Upserted batch %d/%d", i // batch_size + 1, -(-len(documents) // batch_size))

    logger.info("All documents upserted. Triggering index build …")
    await client.build_index(index_name)
    logger.info("Index build complete. The AI doctor can now use '%s' for RAG.", index_name)


if __name__ == "__main__":
    asyncio.run(main())
