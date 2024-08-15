import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { jsonOllamaModel } from "../models";
import { DOCUMENT_GRADER_PROMPT } from "../prompts/document-grader";

const graderPrompt = ChatPromptTemplate.fromTemplate(DOCUMENT_GRADER_PROMPT);

export const documentGraderChain = graderPrompt
  .pipe(jsonOllamaModel)
  .pipe(new JsonOutputParser());
