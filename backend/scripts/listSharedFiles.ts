import dotenv from "dotenv";
dotenv.config();

import { getGoogleClients } from "../src/services/googleSheets.service.js";

async function listSharedFiles() {
  const { driveClient } = await getGoogleClients();
  try {
    console.log("Searching for files visible to service account...");
    const res = await driveClient.files.list({
      fields: "files(id, name, mimeType, owners, shared)",
      pageSize: 100
    });
    const files = res.data.files || [];
    console.log(`Found ${files.length} files.`);
    for (const f of files) {
      console.log(`- Name: "${f.name}", ID: "${f.id}", Mime: "${f.mimeType}", Shared: ${f.shared}`);
    }
  } catch (err: any) {
    console.error("Error listing files:", err.message);
  }
}

listSharedFiles().catch(console.error);
