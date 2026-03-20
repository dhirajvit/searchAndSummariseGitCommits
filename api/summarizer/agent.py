import os
from openai import OpenAI
from summarizer.context import build_prompt, SYSTEM_PROMPT

MODEL = os.environ.get("OPENAI_MODEL", "gpt-5-nano")


def summarize(message: str, author: str, date: str, files: list[str]) -> str:

    client = OpenAI()
    prompt = build_prompt(message, author, date, files)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]
    response = client.chat.completions.create(model=MODEL, messages=messages, max_completion_tokens=3000)
    choice = response.choices[0]
    print(f"finish_reason: {choice.finish_reason}")
    print(f"refusal: {choice.message.refusal}")
    print(f"content: {choice.message.content}")
    return choice.message.content or "No summary returned."
