import dotenv from "dotenv";
dotenv.config();

import { getGoogleClients } from "../src/services/googleSheets.service.js";

const SPREADSHEETS = [
  { id: "19aF1lCDbNBklZfNT4qBJfLrf43lrnCE_sm2tBuWntBk", type: "employee" }, // May Monthly
  { id: "1CDes8COJI9RXtpEtqXy7NTrvteEkArGG7Ezh1XsxFAE", type: "employee" }, // June Monthly
  { id: "1U18pJT6-n-j1DmOZycMS2DNkB39g_zDf1cHHMcu79w8", type: "daily" },    // May Daily
  { id: "1yMI5a9xs_8aQ92Bt0GjHlR8fZLKWoAR3ePEJva77IdI", type: "daily" }     // June Daily
];

async function styleAll() {
  const { sheetsClient } = await getGoogleClients();
  console.log("Starting to style Google Sheets...");

  for (const sheetConfig of SPREADSHEETS) {
    try {
      console.log(`Styling spreadsheet ${sheetConfig.id}...`);
      const meta = await sheetsClient.spreadsheets.get({ spreadsheetId: sheetConfig.id });
      const sheets = meta.data.sheets || [];

      for (const s of sheets) {
        const sheetId = s.properties.sheetId;
        const sheetTitle = s.properties.title;
        if (sheetTitle === "Index") continue;

        console.log(`- Formatting tab: "${sheetTitle}" (ID: ${sheetId})`);

        const requests: any[] = [];
        
        if (sheetConfig.type === "employee") {
          // Employee Sheet Columns: Date(A), CheckIn(B), CheckOut(C), WorkedDuration(D), Overtime(E), Update(F), Status(G)
          const colWidths = [100, 100, 100, 130, 130, 350, 120];
          colWidths.forEach((width, idx) => {
            requests.push({
              updateDimensionProperties: {
                range: { sheetId, dimension: "COLUMNS", startIndex: idx, endIndex: idx + 1 },
                properties: { pixelSize: width },
                fields: "pixelSize"
              }
            });
          });

          // Header Row Height
          requests.push({
            updateDimensionProperties: {
              range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 35 },
              fields: "pixelSize"
            }
          });

          // Body Row Height
          requests.push({
            updateDimensionProperties: {
              range: { sheetId, dimension: "ROWS", startIndex: 1, endIndex: 35 },
              properties: { pixelSize: 26 },
              fields: "pixelSize"
            }
          });

          // Header Format
          requests.push({
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.17, green: 0.24, blue: 0.31 },
                  textFormat: { bold: true, foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 }, fontSize: 10, fontFamily: "Arial" },
                  horizontalAlignment: "CENTER",
                  verticalAlignment: "MIDDLE"
                }
              },
              fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment"
            }
          });

          // Body Format
          requests.push({
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 35, startColumnIndex: 0, endColumnIndex: 7 },
              cell: {
                userEnteredFormat: {
                  textFormat: { fontSize: 10, fontFamily: "Arial" },
                  verticalAlignment: "MIDDLE",
                  wrapStrategy: "CLIP"
                }
              },
              fields: "userEnteredFormat.textFormat.fontSize,userEnteredFormat.textFormat.fontFamily,userEnteredFormat.verticalAlignment,userEnteredFormat.wrapStrategy"
            }
          });

          // Center columns A-E and G
          requests.push({
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 35, startColumnIndex: 0, endColumnIndex: 5 },
              cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
              fields: "userEnteredFormat.horizontalAlignment"
            }
          });
          requests.push({
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 35, startColumnIndex: 6, endColumnIndex: 7 },
              cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
              fields: "userEnteredFormat.horizontalAlignment"
            }
          });

        } else {
          // Daily Sheet Columns: Code(A), Name(B), CheckIn(C), CheckOut(D), WorkedDuration(E), Overtime(F), Update(G), Status(H)
          const colWidths = [110, 160, 100, 100, 130, 130, 350, 120];
          colWidths.forEach((width, idx) => {
            requests.push({
              updateDimensionProperties: {
                range: { sheetId, dimension: "COLUMNS", startIndex: idx, endIndex: idx + 1 },
                properties: { pixelSize: width },
                fields: "pixelSize"
              }
            });
          });

          // Header Row Height
          requests.push({
            updateDimensionProperties: {
              range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 35 },
              fields: "pixelSize"
            }
          });

          // Body Row Height
          requests.push({
            updateDimensionProperties: {
              range: { sheetId, dimension: "ROWS", startIndex: 1, endIndex: 150 },
              properties: { pixelSize: 26 },
              fields: "pixelSize"
            }
          });

          // Header Format
          requests.push({
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.17, green: 0.24, blue: 0.31 },
                  textFormat: { bold: true, foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 }, fontSize: 10, fontFamily: "Arial" },
                  horizontalAlignment: "CENTER",
                  verticalAlignment: "MIDDLE"
                }
              },
              fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment"
            }
          });

          // Body Format
          requests.push({
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 150, startColumnIndex: 0, endColumnIndex: 8 },
              cell: {
                userEnteredFormat: {
                  textFormat: { fontSize: 10, fontFamily: "Arial" },
                  verticalAlignment: "MIDDLE",
                  wrapStrategy: "CLIP"
                }
              },
              fields: "userEnteredFormat.textFormat.fontSize,userEnteredFormat.textFormat.fontFamily,userEnteredFormat.verticalAlignment,userEnteredFormat.wrapStrategy"
            }
          });

          // Center columns A, C-F, H
          requests.push({
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 150, startColumnIndex: 0, endColumnIndex: 1 },
              cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
              fields: "userEnteredFormat.horizontalAlignment"
            }
          });
          requests.push({
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 150, startColumnIndex: 2, endColumnIndex: 6 },
              cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
              fields: "userEnteredFormat.horizontalAlignment"
            }
          });
          requests.push({
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 150, startColumnIndex: 7, endColumnIndex: 8 },
              cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
              fields: "userEnteredFormat.horizontalAlignment"
            }
          });
        }

        // Apply style requests in a single batch
        await sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId: sheetConfig.id,
          requestBody: { requests }
        });
      }
      console.log(`Successfully styled spreadsheet ${sheetConfig.id}.`);
    } catch (err: any) {
      console.error(`Error styling spreadsheet ${sheetConfig.id}:`, err.message);
    }
  }

  console.log("Formatting complete!");
}

styleAll().catch(console.error);
