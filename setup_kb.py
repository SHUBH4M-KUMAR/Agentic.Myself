# setup_kb.py
from openai import OpenAI
import time
import os
from dotenv import load_dotenv



load_dotenv()

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
)
# Step 1: Create vector store
vector_store = client.vector_stores.create(name="my_interview_kb")

# Step 2: Upload file
file_path = "aboutme.docx"
with open(file_path, "rb") as f:
    uploaded_file = client.files.create(file=f, purpose="assistants")
file_id = uploaded_file.id
print("📁 Uploaded File ID:", file_id)

# Step 3: Wait until file is processed
print("⏳ Waiting for file to be processed...")
while True:
    file_status = client.files.retrieve(file_id)
    if file_status.status == "processed":
        break
    time.sleep(1)

# Step 4: Attach the file to the vector store directly (✅ works always)
client.vector_stores.files.create(
    vector_store_id=vector_store.id,
    file_id=file_id
)
# Step 5: Create Assistant
assistant = client.beta.assistants.create(
    name="HomeLLC Voicebot",
    instructions="""
    You are answering interview questions as yourself (Shubam), not as an assistant.
    Speak in first-person — say “I”, not “the candidate” or “the student”.
    Do NOT mention filenames like “aboutme.docx” or “documents”.
    Just answer naturally and conversationally as if you're speaking directly.
    Be fluent, friendly, and confident — like you're in a real interview.
    "Avoid mentioning document titles. Speak in first-person.",
    do not mention about the document in the end like this "【4:0†aboutme.docx】".
    """,
    tools=[{"type": "file_search"}],
    tool_resources={"file_search": {"vector_store_ids": [vector_store.id]}},
    model="gpt-4o"
)

print("✅ Assistant created!")
print("🆔 Assistant ID:", assistant.id)
