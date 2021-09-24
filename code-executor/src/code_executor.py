import base64
import json
from pprint import pprint
from typing import Optional, Union

import requests

from src.utils.bimap import Bimap


class CodeExecutor:
    SUBMISSION_RETRIEVAL_URL = "{url}/submissions/{submission_id}?base64_encoded=true"
    SUBMISSIONS_SEND_URL = "{url}/submissions/?base64_encoded=false&wait=false"
    LANGUAGES_URL = "{url}/languages"

    JSON_HEADERS = {"Content-Type": "application/json"}
    TOKEN_KEY = "token"
    STATUS_KEY = "status"
    ID_KEY = "id"
    NAME_KEY = "name"
    SOURCE_CODE_KEY = "source_code"
    LANGUAGE_ID_KEY = "language_id"
    STDIN_KEY = "stdin"
    BASE64_RESULTS_FIELDS = ["stderr", "stdout", "compile_output", "message"]

    def __init__(self, judge_url: str) -> None:
        """
        Code Executor.
        Sends code execution instructions to remote Judge0 API
        """
        if len(judge_url) == 0:
            raise ValueError("URL cannot be empty")
        self._url = judge_url
        self._languages: Bimap[int, str] = self._set_supported_languages()

    def _create_send_payload(
        self, code: str, language_id: int, input: str
    ) -> dict[str, Union[str, int]]:
        return {
            self.SOURCE_CODE_KEY: code,
            self.LANGUAGE_ID_KEY: language_id,
            self.STDIN_KEY: input,
        }

    def send_to_execute(self, code: str, language_id: int, input: str) -> Optional[str]:
        """
        Sends the code to an executor to be executed.
        Language is based on the language id that is provided
        Input is entry to stdin

        Returns a submission_id containing the results of the output.
        On error returns None
        """
        response = requests.post(
            self.SUBMISSIONS_SEND_URL.format(url=self._url),
            json.dumps(self._create_send_payload(code, language_id, input)),
            headers=self.JSON_HEADERS,
        )
        submission_id = json.loads(response.content).get(self.TOKEN_KEY, None)
        return str(submission_id) if submission_id is not None else None

    def _convert_from_base64(self, result: dict, key: str) -> None:
        """Converts a give key of the result from base 64"""
        if key in result and result[key] is not None:
            result[key] = base64.b64decode(result[key]).decode()

    # TODO: Type the return type more explicitly
    def _get_results(self, submission_id: str) -> dict:
        """Retrieves result from the server 1 time"""
        response = requests.get(
            self.SUBMISSION_RETRIEVAL_URL.format(
                url=self._url, submission_id=submission_id
            )
        )
        return dict(json.loads(response.content))

    # TODO: Type the return type more explicitly
    def get_results(self, submission_id: str) -> dict:
        """This method will block and return the submission"""
        result = self._get_results(submission_id)
        while result.get(self.STATUS_KEY, {}).get(self.ID_KEY, None) == 1:
            result = self._get_results(submission_id)
        for b64_attr in self.BASE64_RESULTS_FIELDS:
            self._convert_from_base64(result, b64_attr)
        return result

    def _set_supported_languages(self) -> Bimap:
        """Returns a Bimap of language that is supported by the executor."""
        response = requests.get(self.LANGUAGES_URL.format(url=self._url))
        languageList = json.loads(response.content)
        return Bimap(
            list(map(lambda x: (x[self.ID_KEY], x[self.NAME_KEY]), languageList))
        )

    def get_language_from_id(self, id: int) -> Optional[str]:
        """
        Gets the programming language from the id.
        Returns None is the id is not found
        """
        return self._languages.get_value_from_key(id)

    def get_id_from_language(self, language: str) -> Optional[int]:
        """
        Gets the id of the language from the name
        Returns None if the language is not found
        """
        return self._languages.get_key_from_value(language)

    def get_supported_languages(self) -> list[str]:
        """Get all the programming languages that are supported"""
        return list(self._languages.get_values())


def main():
    URL = ""
    codeExecutor = CodeExecutor(URL)
    language = codeExecutor.get_supported_languages()[-9]
    lang_id = codeExecutor.get_id_from_language(language)
    print(f"{language}: {lang_id}")
    if lang_id is None:
        return

    submission_id = codeExecutor.send_to_execute(
        "import ctypes\nx = ctypes.c_double.from_param(1e300)\nrepr(x)",
        lang_id,
        "hello\n",
    )
    print(submission_id)
    if submission_id is None:
        return

    results = codeExecutor.get_results(submission_id)
    pprint(results)


if __name__ == "__main__":
    main()