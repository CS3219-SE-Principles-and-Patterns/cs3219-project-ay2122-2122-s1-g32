import os

URL = os.getenv("JUDGE_URL", "http://localhost:2358")
SUBMISSION_RETRIEVAL_URL = "{url}/submissions/{submission_id}?base64_encoded=true"
SUBMISSIONS_SEND_URL = "{url}/submissions/?base64_encoded=false&wait=false"
LANGUAGES_URL = "{url}/languages"

JSON_HEADERS = {"Content-Type": "application/json"}
TOKEN_KEY = "token"
STATUS_KEY = "status"
ID_KEY = "id"
CODE_KEY = "code"
LANGUAGE_KEY = "language"
INPUT_KEY = "input"
NAME_KEY = "name"
SOURCE_CODE_KEY = "source_code"
LANGUAGE_ID_KEY = "language_id"
STDIN_KEY = "stdin"
ERROR_KEY = "error"
BASE64_RESULTS_FIELDS = ["stderr", "stdout", "compile_output", "message"]
