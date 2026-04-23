import { prisma } from "./src/config/prisma.js";
import { oauth2Client } from "./src/config/google.js";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

async function listSpaces() {
  const user = await prisma.user.findFirst({
    where: { isGoogleLinked: true },
    select: { googleRefreshToken: true, email: true }
  });

  if (!user || !user.googleRefreshToken) {
    console.error("No linked user found to test with.");
    return;
  }

  oauth2Client.setCredentials({ refresh_token: user.googleRefreshToken });
  const chat = google.chat({ version: "v1", auth: oauth2Client });

  try {
    const res = await chat.spaces.list();
    console.log("Found Spaces for " + user.email + ":");
    console.log(JSON.stringify(res.data.spaces, null, 2));
  } catch (err) {
    console.error("Error listing spaces:", err.message);
  }
}

listSpaces();
