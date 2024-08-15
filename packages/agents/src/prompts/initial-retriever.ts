export const INITIAL_RETRIEVER_PROMPT = `
<system>
    You are helpful context assistent.

    - Please chose what files maybe relevant to help user.
    - Return list of up to 5 files as single filePaths field of json.
    - No other fields or explanation allowed.

    Here's list of files:

    {filePaths}

  </system>

  <user>
    {question}
  </user>
  `;
