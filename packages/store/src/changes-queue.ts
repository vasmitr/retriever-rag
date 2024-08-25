import * as dotenv from "dotenv";
dotenv.config();

import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

export class ChangesQueue {
  private qdrant: QdrantClient;
  private collectionNamePrefix: string = "changes_queue_";

  constructor(qdrantUrl: string) {
    console.log(`Initializing ChangesQueue with Qdrant URL: ${qdrantUrl}`);
    this.qdrant = new QdrantClient({ url: qdrantUrl });
  }

  private async initializeCollection(collectionName: string): Promise<void> {
    console.log(`Initializing collection: ${collectionName}`);
    try {
      const collectionExists = (
        await this.qdrant.collectionExists(collectionName)
      ).exists;
      if (!collectionExists) {
        console.log(`Creating new collection: ${collectionName}`);
        await this.qdrant.createCollection(collectionName, {
          vectors: { size: 1, distance: "Dot" },
        });
      } else {
        console.log(`Collection ${collectionName} already exists`);
      }
    } catch (error) {
      console.error(`Error initializing collection ${collectionName}:`, error);
      throw error;
    }
  }

  private getCollectionName(projectId: string): string {
    return `${this.collectionNamePrefix}${projectId}`;
  }

  private hashFilePath(filePath: string): string {
    return crypto.createHash("sha256").update(filePath).digest("hex");
  }

  public async enqueue(projectId: string, filePath: string): Promise<boolean> {
    const collectionName = this.getCollectionName(projectId);
    console.log(`Enqueueing: ${filePath} for collection ${collectionName}`);
    await this.initializeCollection(collectionName);
    const filePathHash = this.hashFilePath(filePath);

    try {
      // Check if the file is already in the queue
      const existing = await this.qdrant.scroll(collectionName, {
        filter: {
          must: [{ key: "filePathHash", match: { value: filePathHash } }],
        },
        limit: 1,
      });

      if (existing.points.length > 0) {
        console.log(`File already in queue: ${filePath} for collection ${collectionName}`);
        return false;
      }

      // If not in queue, add it
      const id = uuidv4();
      await this.qdrant.upsert(collectionName, {
        wait: true,
        points: [
          {
            id,
            vector: [1],
            payload: { filePath, filePathHash, timestamp: Date.now() },
          },
        ],
      });
      console.log(`Enqueued: ${filePath} for collection ${collectionName}`);
      return true;
    } catch (error) {
      console.error(`Error enqueueing file ${filePath} for collection ${collectionName}:`, error);
      throw error;
    }
  }

  public async dequeue(projectId: string): Promise<string | null> {
    const collectionName = this.getCollectionName(projectId);
    await this.initializeCollection(collectionName);
    try {
      const result = await this.qdrant.search(collectionName, {
        vector: [1],
        limit: 1,
        with_payload: true,
        with_vector: false,
      });

      if (result.length === 0) {
        console.log(`No files to dequeue for collection ${collectionName}`);
        return null;
      }

      const point = result[0];

      if (!point) {
        throw new Error("No point found");
      }

      const filePath = point.payload?.filePath as string;

      // Remove the point from the collection
      await this.qdrant.delete(collectionName, {
        points: [point.id],
        wait: true,
      });

      console.log(`Dequeued file ${filePath} from collection ${collectionName}`);
      return filePath;
    } catch (error) {
      console.error(`Error dequeuing file for collection ${collectionName}:`, error);
      throw error;
    }
  }

  public async getQueueSize(projectId: string): Promise<number> {
    const collectionName = this.getCollectionName(projectId);
    await this.initializeCollection(collectionName);
    try {
      const collection = await this.qdrant.getCollection(collectionName);
      const size = collection.points_count || 0;
      console.log(`Queue size for collection ${collectionName}: ${size}`);
      return size;
    } catch (error) {
      console.error(`Error getting queue size for collection ${collectionName}:`, error);
      throw error;
    }
  }

  public async isQueued(projectId: string, filePath: string): Promise<boolean> {
    const collectionName = this.getCollectionName(projectId);
    await this.initializeCollection(collectionName);
    const filePathHash = this.hashFilePath(filePath);
    try {
      const result = await this.qdrant.search(collectionName, {
        filter: {
          must: [{ key: "filePathHash", match: { value: filePathHash } }],
        },
        limit: 1,
      });
      const isQueued = result.length > 0;
      console.log(`File ${filePath} is queued for collection ${collectionName}: ${isQueued}`);
      return isQueued;
    } catch (error) {
      // @ts-ignore
      if (error.message.includes("not found")) {
        console.log(`Collection ${collectionName} not found, assuming file is not queued`);
        return false;
      }
      console.error(`Error checking if file ${filePath} is queued for collection ${collectionName}:`, error);
      throw error;
    }
  }
}
