import * as dotenv from "dotenv";
dotenv.config();

import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

// TODO: support codebase sessions / multiple projects
export class ChangesQueue {
  private qdrant: QdrantClient;
  private collectionName: string = "changes_queue";

  constructor(qdrantUrl: string) {
    this.qdrant = new QdrantClient({ url: qdrantUrl });
    this.initializeCollection();
  }

  private async initializeCollection(): Promise<void> {
    const collectionExists = (
      await this.qdrant.collectionExists(this.collectionName)
    ).exists;
    if (!collectionExists) {
      await this.qdrant.createCollection(this.collectionName, {
        vectors: { size: 1, distance: "Dot" },
      });
    }
  }

  private hashFilePath(filePath: string): string {
    return crypto.createHash("sha256").update(filePath).digest("hex");
  }

  public async enqueue(filePath: string): Promise<boolean> {
    console.log(`Enqueueing: ${filePath}`);
    const filePathHash = this.hashFilePath(filePath);

    // Check if the file is already in the queue
    const existing = await this.qdrant.scroll(this.collectionName, {
      filter: {
        must: [{ key: "filePathHash", match: { value: filePathHash } }],
      },
      limit: 1,
    });

    if (existing.points.length > 0) {
      console.log(`File already in queue: ${filePath}`);
      return false;
    }

    // If not in queue, add it
    const id = uuidv4();
    await this.qdrant.upsert(this.collectionName, {
      wait: true,
      points: [
        {
          id,
          vector: [1],
          payload: { filePath, filePathHash, timestamp: Date.now() },
        },
      ],
    });
    console.log(`Enqueued: ${filePath}`);
    return true;
  }

  public async dequeue(): Promise<string | null> {
    const result = await this.qdrant.search(this.collectionName, {
      vector: [1],
      limit: 1,
      with_payload: true,
      with_vector: false,
    });

    if (result.length === 0) {
      return null;
    }

    const point = result[0];

    if (!point) {
      throw new Error("No point found");
    }

    const filePath = point.payload?.filePath as string;

    // Remove the point from the collection
    await this.qdrant.delete(this.collectionName, {
      points: [point.id],
      wait: true,
    });

    return filePath;
  }

  public async getQueueSize(): Promise<number> {
    const collection = await this.qdrant.getCollection(this.collectionName);
    return collection.points_count || 0;
  }

  public async isQueued(filePath: string): Promise<boolean> {
    const id = this.hashFilePath(filePath);
    try {
      await this.qdrant.retrieve(this.collectionName, { ids: [id] });
      return true;
    } catch (error) {
      // @ts-ignore
      if (error.message.includes("not found")) {
        return false;
      }
      throw error;
    }
  }
}
