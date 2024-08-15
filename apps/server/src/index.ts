import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import retrieve from "./api/retrieve";

const { PORT = 49152, QDRANT_URL } = process.env;

const app = express();
app.use(express.json());

app.use("/api/retrieve", retrieve);

app.listen(PORT);
console.log(`Server started on port ${PORT}`);
