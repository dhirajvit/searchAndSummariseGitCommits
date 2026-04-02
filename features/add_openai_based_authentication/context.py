import json
from pathlib import Path


def get_system_prompt() -> str:
    json_path = Path(__file__).parent.parent / "add_open_ai_authentication.json"
    requirement_json = json.loads(json_path.read_text())

    return f"""You are a senior backend engineer.

Generate production-ready code using:
- Clean architecture
- Error handling
- Validation

Input:
{json.dumps(requirement_json, indent=2)}"""
