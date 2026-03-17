import os
import shutil
import chromadb
import logging
import warnings

# --- Suppress Technical Warnings ---
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
logging.getLogger("huggingface_hub").setLevel(logging.ERROR)
logging.getLogger("sentence_transformers").setLevel(logging.ERROR)
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter


class MedicalVectorStore:
    def __init__(self):
        # ---------------------------------------
        # FIXED PATH HANDLING
        # ---------------------------------------
        current_dir = os.path.dirname(os.path.abspath(__file__))   # backend/rag
        backend_dir = os.path.dirname(current_dir)                 # backend

        self.docs_path = os.path.join(backend_dir, "medical_docs")
        self.persist_directory = os.path.join(current_dir, "chroma_db")

        print(f"📂 Docs Path: {self.docs_path}")
        print(f"📦 DB Path: {self.persist_directory}")

        # ---------------------------------------
        # EMBEDDINGS
        # ---------------------------------------
        self.embedding = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )

        # ---------------------------------------
        # CHROMA CLIENT (PERSISTENT)
        # ---------------------------------------
        self.client = chromadb.PersistentClient(path=self.persist_directory)

        self.db = Chroma(
            client=self.client,
            collection_name="medical_knowledge",
            embedding_function=self.embedding
        )

        # ---------------------------------------
        # AUTO INDEX IF EMPTY
        # ---------------------------------------
        try:
            if len(self.db.get()["ids"]) == 0:
                self._index_documents()
        except:
            # If DB corrupted or first time
            self._index_documents()

    # ---------------------------------------
    # INDEX DOCUMENTS
    # ---------------------------------------
    def _index_documents(self):
        print("\n📥 Indexing medical documents...")

        # Clear old DB (safe reset)
        if os.path.exists(self.persist_directory):
            shutil.rmtree(self.persist_directory, ignore_errors=True)

        os.makedirs(self.persist_directory, exist_ok=True)

        all_docs = []

        # Check docs folder
        if not os.path.exists(self.docs_path):
            print(f"❌ Directory not found: {self.docs_path}")
            return

        files = os.listdir(self.docs_path)

        if not files:
            print("❌ No files found in medical_docs.")
            return

        # Load PDFs
        for file in files:
            if file.endswith(".pdf"):
                file_path = os.path.join(self.docs_path, file)
                try:
                    print(f"📄 Loading: {file}")
                    # Use rapidocr or simple loader - but add check for encrypted/broken
                    loader = PyPDFLoader(file_path)
                    documents = loader.load()
                    if documents:
                        all_docs.extend(documents)
                    else:
                        print(f"⚠  {file} appears empty or unreadable.")
                except Exception as e:
                    # Catching specific decompression or header errors to avoid flooding
                    error_msg = str(e)
                    if "header check" in error_msg or "startxref" in error_msg:
                        print(f"❌ {file} is corrupted or unsupported format.")
                    else:
                        print(f"⚠ Error loading {file}: {e}")

        if not all_docs:
            print("❌ No valid documents to index.")
            return

        # Split documents
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=150
        )

        split_docs = text_splitter.split_documents(all_docs)

        print(f"🧠 Total chunks created: {len(split_docs)}")

        # Store in Chroma
        self.db = Chroma.from_documents(
            documents=split_docs,
            embedding=self.embedding,
            client=self.client,
            collection_name="medical_knowledge"
        )

        print("✅ Indexing complete.\n")

    # ---------------------------------------
    # RETRIEVE CONTEXT
    # ---------------------------------------
    def retrieve(self, query: str, k: int = 3):
        try:
            results = self.db.similarity_search(query, k=k)

            if not results:
                print("⚠ No relevant documents found.")

            return [doc.page_content for doc in results]

        except Exception as e:
            print(f"❌ Retrieval error: {e}")
            return []