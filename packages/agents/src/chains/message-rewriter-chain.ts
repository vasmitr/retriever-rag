import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ollamaModel } from "../models";
import { MESSAGE_REWRITER_PROMPT } from "../prompts/message-rewriter";

const rewriterPrompt = ChatPromptTemplate.fromTemplate(MESSAGE_REWRITER_PROMPT);

export const messageRewriterChain = rewriterPrompt
  .pipe(ollamaModel)
  .pipe(new StringOutputParser());
