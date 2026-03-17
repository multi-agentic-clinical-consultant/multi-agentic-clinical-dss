# Multi-Agentic Clinical consultant 

A state-of-the-art, AI-powered Clinical Decision Support System. This system leverages a **Multi-Agent Orchestration** pattern with **Long-term Memory** via MongoDB to provide persistent, evidence-based clinical assessments.

## 🌟 Key Features

- **Persistent Patient Memory**: Integrates **MongoDB Atlas** to store visit history. The AI "remembers" previous diagnoses and prescriptions, enabling temporal reasoning and follow-up care.
- **Multimodal Consultation**: 
    - **Voice-to-Voice**: High-speed transcription via Groq (Whisper) and realistic speech synthesis via ElevenLabs.
    - **Text-Analysis**: Structured clinical evaluations from raw symptoms.
- **Evidence-Based RAG**: Retrieval-Augmented Generation using **ChromaDB** to index local medical PDFs (e.g., AAP Guidelines, clinical papers).
- **Automated Scribe**: Generates structured **SOAP Notes** (Subjective, Objective, Assessment, Plan) in JSON format.
- **Advanced Orchestration**: Built with **LangGraph** for conditional routing between specialized agents (Consultant, Scribe, Prescription).

## 🏗️ System Components

1.  **Consultant Agent**: The core diagnostic engine using Llama 3.3 and Medical RAG.
2.  **Transcription Agent**: The medical scribe that structures session data into hospital-ready documentation.
3.  **Prescription Agent**: Handles dosage calculation and medication planning.
4.  **Database Layer**: Manages session snapshots and patient history in MongoDB.

## 🛠️ Getting Started

### 1. Prerequisites
- Python 3.10+ (Tested on 3.13)
- [FFmpeg](https://ffmpeg.org/) installed and added to your PATH.
- A running MongoDB Atlas cluster or local MongoDB instance.

### 2. Installation
```bash
# Set up virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
GROQ_API_KEY=your_key
ELEVENLABS_API_KEY=your_key (optional, defaults to gTTS)
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/
```

### 4. Running the System
```bash
cd backend
uvicorn main:app --reload
```

## 🧪 Testing the Integrated Flow
To verify the MongoDB connection and the AI's "memory" across two visits:
```bash
python backend/test_integrated_db.py
```

## 📂 Project Structure
- `backend/agents/`: Specialized AI agents (STT, TTS, Scribe, Consultant).
- `backend/graph/`: LangGraph workflow definition and state management.
- `backend/medical_docs/`: Drop your medical PDFs here for RAG indexing.
- `backend/rag/`: Local vector database storage.
- `backend/database.py`: MongoDB Atlas connection logic.
