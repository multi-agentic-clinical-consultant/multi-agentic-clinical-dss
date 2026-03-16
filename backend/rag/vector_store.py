import os
import shutil
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter


class MedicalVectorStore:
    def __init__(self):
        self.persist_directory = "rag/chroma_db"
        self.docs_path = "medical_docs"

        self.embedding = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        
        # Check if DB exists
        if os.path.exists(self.persist_directory):
            self.db = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embedding
            )
            # If DB is empty, re-index
            if len(self.db.get()["ids"]) == 0:
                 # We must free the handles before trying to delete the directory on Windows
                 self.db = None
                 self._index_documents()
        else:
             self._index_documents()
             self.db = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embedding
            )

    # ---------------------------------------
    # Index External PDF Documents
    # ---------------------------------------
    def _index_documents(self):
        print("Indexing medical documents...")

        # Clear existing DB if any (to avoid corruption issues)
        if os.path.exists(self.persist_directory):
            shutil.rmtree(self.persist_directory, ignore_errors=True)

        all_docs = []

        if not os.path.exists(self.docs_path):
            print(f"Warning: Directory {self.docs_path} not found.")
            return

        for file in os.listdir(self.docs_path):
            if file.endswith(".pdf"):
                file_path = os.path.join(self.docs_path, file)
                try:
                    print(f"Loading {file}...")
                    loader = PyPDFLoader(file_path)
                    documents = loader.load()
                    all_docs.extend(documents)
                except Exception as e:
                    print(f"Error loading {file}: {e}")

        if not all_docs:
            print("No documents found to index.")
            return

        # Split into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=150
        )

        split_docs = text_splitter.split_documents(all_docs)

        # Store in Chroma
        self.db = Chroma.from_documents(
            documents=split_docs,
            embedding=self.embedding,
            persist_directory=self.persist_directory
        )

        print("Indexing complete.")

    # ---------------------------------------
    # Retrieval
    # ---------------------------------------
    def retrieve(self, query: str, k: int = 3):
        try:
            results = self.db.similarity_search(query, k=k)
            return [doc.page_content for doc in results]
        except Exception as e:
            print(f"Retrieval error: {e}")
            return []
