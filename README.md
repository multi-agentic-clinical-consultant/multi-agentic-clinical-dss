# Multi-Agentic Clinical Decision Support System (DSS)

A comprehensive, AI-powered Clinical Decision Support System that leverages a multi-agent architectural pattern to process multimodal patient data (text, voice, and medical imaging). The system analyzes symptoms, visual findings, and medical domains to generate detailed clinical assessments and structured SOAP notes.

## 🚀 Features

- **Multi-Agent Architecture**: Built with LangGraph, utilizing specialized agents for medical tasks.
- **Voice-to-Voice Pipelines**: End-to-end voice consultation. Uses Speech-to-Text (Whisper) to transcribe patient input, processes it, and returns Text-to-Speech (gTTS) audio responses.
- **Vision Analysis**: Integrates visual analysis for medical imaging (e.g., X-Rays, scans) directly into the diagnostic workflow.
- **Retrieval-Augmented Generation (RAG)**: Uses ChromaDB to index local medical documents for highly contextual, evidence-based diagnoses.
- **SOAP Note Generation**: Automatically generates structured clinical documentation (Subjective, Objective, Assessment, Plan).
- **FastAPI Backend**: Exposes clean APIs for text analysis, audio transcription, and full voice consultations.

## 🏗️ System Architecture

The core orchestration is handled by **LangGraph**, which routes requests conditionally through various specialized agents:
1. **STT Agent**: Transcribes incoming audio.
2. **Intent & Vision Agent**: Classifies the interaction type and extracts findings from uploaded medical imaging.
3. **Consultant Agent**: The core diagnostic engine. Uses RAG against a ChromaDB vector store and a general physician LLM to evaluate the symptoms.
4. **Scribe Agent**: Formats the final diagnostic assessment into a formal SOAP note.
5. **TTS Agent**: Converts the consultative response back to an audio file for the patient/practitioner.

## 🛠️ Prerequisites

- Python 3.9+
- [FFmpeg](https://ffmpeg.org/download.html) (Required for Whisper audio processing)
- A [Groq API Key](https://console.groq.com/) for fast LLM inference

## 💻 Installation

1. **Clone the repository and set up a Virtual Environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root formatting your Groq API key:
   ```env
   GROQ_API_KEY=your_actual_api_key_here
   ```

4. **Add Medical Documents (Optional but Recommended)**
   Place any medical reference PDFs or text guides in the `backend/medical_docs` folder. The RAG system will index these documents locally into ChromaDB on startup.

## 🏃 Running the Application

Start the backend FastAPI server using Uvicorn:

```bash
cd backend
uvicorn main:app --reload
```

The server will be available at `http://127.0.0.1:8000`.
