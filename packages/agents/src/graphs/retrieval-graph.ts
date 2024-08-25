import type { Document } from "@langchain/core/documents";
import { Store } from "@repo/store/store";
import {
  initialContextChain,
  messageRewriterChain,
  documentGraderChain,
} from "../chains";
import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";

interface AdaptiveRAGGraphState {
  question: string;
  projectId: string;
  query: string;
  previousQueries: string[];
  generation: string;
  filePaths: string[];
  documents: Document[];
}

export const defaultRetrievalGraphState = {
  question: null,
  query: null,
  projectId: null,
  previousQueries: null,
  generation: null,
  filePaths: null,
  documents: {
    value: (x: Document[], y: Document[]) => y,
    default: () => [],
  },
};

const store = new Store();

const retrieve = async (state: AdaptiveRAGGraphState) => {
  console.log("---RETRIEVE---");
  const documents = await store.invokeRetriever(state.projectId, state.query);

  return {
    documents: [...(state.documents || []), ...(documents || [])],
    previousQueries: [...(state.previousQueries || []), state.query],
  };
};

const gradeDocuments = async (state: AdaptiveRAGGraphState) => {
  console.log("---CHECK DOCUMENT RELEVANCE TO QUESTION---");

  const relevantDocs: Document[] = [];
  for (const doc of state.documents) {
    let grade: { score?: string } = {};

    try {
      grade = await documentGraderChain.invoke({
        question: state.question,
        content: doc.pageContent,
      });
    } catch (e) {
      if (e instanceof Error) {
        console.log("Grader error: " + e.message);
      }
    }

    if (grade.score === "yes") {
      console.log("---GRADE: DOCUMENT RELEVANT---");
      relevantDocs.push(doc);
    } else {
      console.log("---GRADE: DOCUMENT NOT RELEVANT---");
    }
  }
  return { documents: relevantDocs };
};

// Re-write question
const transformQuery = async (state: AdaptiveRAGGraphState) => {
  console.log("---TRANSFORM QUERY---");
  try {
    const betterQuestion = await messageRewriterChain.invoke({
      question: state.question,
      filePaths: state.filePaths.join(","),
      previousQueries: state.previousQueries?.join("\n"),
    });
    return { query: betterQuestion };
  } catch (e) {
    if (e instanceof Error) {
      console.log("LLM Error: " + e.message);
    }
  }
  return { ...state };
};

const checkIfContextSufficient = async (state: AdaptiveRAGGraphState) => {
  if (state.documents?.length >= 3) {
    return "useful";
  }
  return "not_useful";
};

const prepareInitialContext = async (state: AdaptiveRAGGraphState) => {
  console.log("---PREPARE INITIAL QUERY---");
  try {
    const result: Record<string, string[]> = await initialContextChain.invoke({
      question: state.question,
      filePaths: state.filePaths.join(","),
    });

    return { query: result?.filePaths?.join(" ") || "" };
  } catch (e) {
    if (e instanceof Error) {
      console.log("LLM Error: " + e.message);
    }
  }
  return { ...state };
};

const graph = new StateGraph<AdaptiveRAGGraphState>({
  channels: defaultRetrievalGraphState,
})
  .addNode("prepare", prepareInitialContext)
  .addNode("retrieve", retrieve)
  .addNode("grade_documents", gradeDocuments)
  .addNode("transform_query", transformQuery)

  .addEdge(START, "prepare")
  .addEdge("prepare", "retrieve")
  .addEdge("retrieve", "grade_documents")
  .addConditionalEdges("grade_documents", checkIfContextSufficient, {
    useful: END,
    not_useful: "transform_query",
    error: "grade_documents",
  })
  .addEdge("transform_query", "retrieve");

export const workflow = graph.compile({
  checkpointer: new MemorySaver(), // TODO: implement Qdrant checkpointer
});
