import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { jsonOllamaModel } from "../models";
import { INITIAL_RETRIEVER_PROMPT } from "../prompts/initial-retriever";

const initialContextTemplate = ChatPromptTemplate.fromTemplate(
  INITIAL_RETRIEVER_PROMPT
);

export const initialContextChain = initialContextTemplate
  .pipe(jsonOllamaModel)
  .pipe(new JsonOutputParser());
