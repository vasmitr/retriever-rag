import express, { Response } from "express";

const { PORT = 49152 } = process.env;

const app = express();
app.use(express.json());

interface RetriveResult {
  contents: string[];
  title: string;
  description: string;
}
app.post("/api/retrieve", async (req, res: Response<RetriveResult[]>) => {
  try {
    const query = (req.body?.query || "") as string;

    console.log("Query:", query);

    if (!query) {
      return res.status(400).json([]);
    }

    // call agent

    res.json([]);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

app.listen(PORT);
console.log(`Server started on port ${PORT}`);
