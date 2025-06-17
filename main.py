# main.py
from fastapi import FastAPI, UploadFile
from fastapi.responses import StreamingResponse
from io import BytesIO
from openai import OpenAI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import requests
import tempfile
from fastapi.staticfiles import StaticFiles
import re
import time
import os
from dotenv import load_dotenv
from elevenlabs import ElevenLabs, play


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or "*" for all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory="static"), name="static")


VOICE_ID = "P7vsEyTOpZ6YUTulin8m"
ASSISTANT_ID = "asst_bFsaVAWB3fS7RLlZ70HNWk7Q"
load_dotenv()

elevenlabs = ElevenLabs(
    api_key=os.getenv("ELEVENLABS_API_KEY"),
)
client= OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
)

@app.get("/")
def root():
    return {"message": "VoiceBot API is live!"}
@app.post("/voicebot")
async def voicebot(audio: UploadFile):
    # Step 1: Transcribe audio
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        tmp.write(await audio.read())
        tmp.flush()

        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=open(tmp.name, "rb")
        )
    user_input = transcript.text

    # Step 2: Create thread
    thread = client.beta.threads.create()

    # Step 3: Post message
    client.beta.threads.messages.create(
        thread_id=thread.id,
        role="user",
        content=user_input
    )

    # Step 4: Run assistant
    run = client.beta.threads.runs.create(
        assistant_id=ASSISTANT_ID,
        thread_id=thread.id
    )

    # Step 5: Wait for it to finish
    while True:
        status = client.beta.threads.runs.retrieve(
            run_id=run.id,
            thread_id=thread.id
        )
        if status.status == "completed":
            break
        time.sleep(1)

    # Step 6: Get final message
    messages = client.beta.threads.messages.list(thread_id=thread.id)
    reply = messages.data[0].content[0].text.value
    cleaned_reply = re.sub(r"【.*?†.*?】", "", reply).strip()
    print(cleaned_reply)

    audio = elevenlabs.text_to_speech.convert(
        text=cleaned_reply,
        voice_id=VOICE_ID,
        model_id="eleven_flash_v2_5",
        output_format="mp3_44100_128",
        voice_settings={
        "stability": 0.3,          # more expressive and dynamic
        "similarity_boost": 0.85,  # sounds more like the selected voice  # enables deeper/resonant tone
        }
    )

  #  audio_bytes = b"".join(audio)
    # Save audio to temp file
    filename = f"audio_{int(time.time())}.mp3"
    output_path = f"static/{filename}"
    with open(output_path, "wb") as f:
        for chunk in audio:
            f.write(chunk)

    return JSONResponse({
        "userText": user_input,
        "aiText": cleaned_reply,
        "audioUrl": f"https://agentic-myself.onrender.com/static/{filename}"
    })
