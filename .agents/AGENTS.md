# Project Tracking & Sync Rules

## 1. Trigger Phrase: "Sync Project Sheet" or "/sync-excel"
*   **Trigger:** Whenever the user says `"Sync Project Sheet"`, `"/sync-excel"`, or mentions updating the task list/spreadsheet.
*   **Required Action:**
    1.  Update the progress percentages and `"lastUpdated"` field in [project-memory.json](file:///d:/Intellisys/HRMS-NEW/project-memory.json) using the current date-time.
    2.  Update the status of the task in [tasks.json](file:///d:/Intellisys/HRMS-NEW/tasks.json).
    3.  Log the task progress in [daily-log.json](file:///d:/Intellisys/HRMS-NEW/daily-log.json).
    4.  Update the narrative of the task in [daily-status-feed.json](file:///d:/Intellisys/HRMS-NEW/daily-status-feed.json).
    5.  Run the Excel generator script using `npm run sync-excel` (within the `backend` folder) to compile these updates into the `Standup_Feed` and other tracker sheets inside `HRMS_Project_Management.xlsx`.

## 2. Automatic Updates
*   At the end of any feature implementation, integration, or bug fix task, the agent should proactively review these tracking files, update them, and run the sync script to ensure the project documentation is never stale.
