import express, { Response, Router } from "express";
import { invoreRetrievalAgent } from "@repo/agents";

const router = Router();

interface RetriveResult {
  contents: string[];
  title: string;
  description: string;
}
router.post("/", async (req, res: Response<RetriveResult[]>) => {
  try {
    const { query } = req.body || {};

    console.log("Query:", query);

    if (!query) {
      return res.status(400).json([]);
    }

    const response = await invoreRetrievalAgent(query);

    console.log("Documents found", response.documents?.length);

    res.json(
      response.documents?.map((doc: Record<string, any>) => ({
        contents: [doc.pageContent],
        title: doc.metadata?.filePath || "",
        description: doc.metadata?.filePath || "",
      }))
    );

    res.json([]);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

export default router;
