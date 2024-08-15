import { randomUUID } from "crypto";
import { RunnableConfig } from "@langchain/core/runnables";

import { readThree } from "@repo/utils/fs";
import { workflow } from "./graphs/retrieval-graph";

const config: RunnableConfig = { configurable: { thread_id: randomUUID() } };

export const invoreRetrievalAgent = async (
  userMessage: string,
  path = "./"
) => {
  const filePaths = await readThree(path);

  return workflow.invoke(
    { question: userMessage, filePaths },
    {
      ...config,
    }
  );
};
