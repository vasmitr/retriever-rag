import { randomUUID } from "crypto";
import { RunnableConfig } from "@langchain/core/runnables";

import { readThree } from "@repo/utils/fs";
import { defaultRetrievalGraphState, workflow } from "./graphs/retrieval-graph";

const config: RunnableConfig = { configurable: { thread_id: randomUUID() } };

export const invokeRetrievalAgent = async (
  userMessage: string,
  path: string
) => {
  if (!path) {
    throw new Error("No path provided");
  }

  const filePaths = await readThree(path);

  const pathEntries = path.split("/");
  const projectId = pathEntries[pathEntries.length - 1];

  return workflow.invoke(
    {
      query: null,
      previousQueries: null,
      generation: null,
      documents: null,
      question: userMessage,
      filePaths,
      projectId,
    },
    {
      ...config,
    }
  );
};
