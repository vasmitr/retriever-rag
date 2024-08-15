import * as dotenv from "dotenv";
dotenv.config();

import { QdrantVectorStore } from "@langchain/qdrant";
import { OllamaEmbeddings } from "@langchain/ollama";
import { Document } from "langchain/document";
import { QdrantClient } from "@qdrant/js-client-rest";

export interface FileRecord {
  filePath: string;
  content: string;
}

const collectionName = "codebase"; // TODO: support multiple projects

export const embeddings = new OllamaEmbeddings({
  model: "nomic-embed-text",
  baseUrl: process.env.OLLAMA_URL,
});

export const vectorStore = new QdrantVectorStore(embeddings, {
  url: process.env.QDRANT_URL,
  collectionName,
});

export const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL,
});

export const indexFile = async (file: FileRecord): Promise<void> => {
  await vectorStore.ensureCollection();

  if (file) {
    await qdrantClient.delete(collectionName, {
      filter: {
        should: {
          key: "metadata.filePath",
          match: { value: file.filePath },
        },
      },
      wait: true,
    });

    const doc = new Document({
      pageContent: `### File: ${file.filePath}\n${file.content}`,
      metadata: {
        filePath: file.filePath,
      },
    });

    await vectorStore.addDocuments([doc]);
  }
};
