import * as dotenv from "dotenv";
dotenv.config();

import { QdrantVectorStore } from "@langchain/qdrant";
import { OllamaEmbeddings } from "@langchain/ollama";
import { Document } from "langchain/document";
import { QdrantClient } from "@qdrant/js-client-rest";

export interface FileRecord {
  project: string;
  filePath: string;
  content: string;
}

export class Store {
  private embeddings: OllamaEmbeddings;
  private qdrantClient: QdrantClient;
  private vectorStores: Map<string, QdrantVectorStore>;

  constructor() {
    this.embeddings = new OllamaEmbeddings({
      model: "nomic-embed-text",
      baseUrl: process.env.OLLAMA_URL,
    });

    this.qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL,
    });

    this.vectorStores = new Map();
  }

  private async getOrCreateVectorStore(
    collectionName: string
  ): Promise<QdrantVectorStore> {
    if (!this.vectorStores.has(collectionName)) {
      const vectorStore = new QdrantVectorStore(this.embeddings, {
        url: process.env.QDRANT_URL,
        collectionName,
      });
      await vectorStore.ensureCollection();
      this.vectorStores.set(collectionName, vectorStore);
    }
    return this.vectorStores.get(collectionName)!;
  }

  async indexFile(collectionName: string, file: FileRecord): Promise<void> {
    const vectorStore = await this.getOrCreateVectorStore(collectionName);

    if (file) {
      await this.qdrantClient.delete(collectionName, {
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
          project: file.project,
        },
      });

      await vectorStore.addDocuments([doc]);
    }
  }

  async invokeRetriever(
    collectionName: string,
    query: string
  ): Promise<Document[]> {
    const vectorStore = await this.getOrCreateVectorStore(collectionName);
    const retriver = vectorStore.asRetriever();
    return retriver.invoke(query);
  }
}
