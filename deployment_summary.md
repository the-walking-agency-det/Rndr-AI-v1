# Deployment Summary - Video Architecture Update

## Overview
This update introduces a robust **Server-Side Video Generation & Stitching Workflow** using Firebase Cloud Functions, Inngest, and Google Cloud Transcoder. This moves long-running processes off the client, improving reliability and enabling background processing.

## Key Changes

### 1. Server-Side Long-Form Video Generation
*   **New Function:** `triggerLongFormVideoJob` (Callable)
    *   Validates inputs (prompts, duration, startImage).
    *   Creates a `videoJobs` Firestore document with status `queued`.
    *   Dispatches an Inngest event `video/long_form.requested`.
*   **Inngest Workflow:** `generateLongFormVideoFn`
    *   Iterates through prompts to generate video segments via Vertex AI (Veo).
    *   **Rate Limiting & Cost Control:** (Planned) Enforced via checking user tiers before triggering.
    *   **Observability:** Logs job lifecycle to Cloud Logging. Inngest provides step-level tracing.
*   **Input Validation:** Strict Zod validation and sanity checks on prompts array length.

### 2. Server-Side Stitching (Google Cloud Transcoder)
*   **New Function:** `stitchVideoFn` (Inngest)
    *   Triggered after all segments are generated.
    *   Creates a Google Cloud Transcoder job to concatenate segments into a single MP4.
    *   **Polling:** Implements a polling loop (up to 5 mins) to wait for Transcoder completion.
    *   **Status Updates:** Updates Firestore with `stitching` -> `completed` (or `failed`).
    *   **Error Handling:** Catches errors and updates Firestore with `stitchError` and `failed` status to notify the UI.

### 3. Client-Side Updates
*   **`VideoGenerationService`:** Refactored to call `triggerLongFormVideoJob` instead of managing the loop client-side.
    *   Passes only serializable options (removing functions/callbacks from payload).
*   **`useMerchandise`:** Added error handling for catalog loading.
*   **`CampaignCard`:** Ensured `dept-marketing` and `dept-campaign` tokens are used (verified in `index.css`).

## Deployment Instructions

1.  **Deploy Cloud Functions:**
    ```bash
    npm run build --prefix functions
    firebase deploy --only functions
    ```
    *Ensure `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `GEMINI_API_KEY` are set in Firebase environment.*

2.  **Environment Variables:**
    *   `VITE_API_KEY`: Required for client-side AI.
    *   `VITE_FIREBASE_CONFIG`: Standard Firebase config.
    *   `VITE_VERTEX_PROJECT_ID` / `LOCATION`: For direct Vertex calls (if any remain).

## Observability & Monitoring Strategy

To ensure production reliability, we will track the following metrics:

*   **Job Latency:** Time from `queued` to `completed`.
*   **Stitch Success Rate:** Success vs. Failure count for `stitchVideoFn`.
*   **Veo API Errors:** Track `5xx` or `4xx` errors from Vertex AI.
*   **Cost Monitoring:** Monitor Inngest function execution time and Transcoder minutes via Google Cloud Console.

### Logs
All functions log to Cloud Logging with structured data (Job ID, User ID).

```json
{
  "severity": "INFO",
  "message": "[VideoJob] Triggered for JobID: ..., User: ..."
}
```

## Error Handling & Retry Strategy

*   **Inngest Retries:** `generateVideoFn` and `stitchVideoFn` are configured with Inngest's default retry policy (exponential backoff) for transient failures (e.g., network blips).
*   **Fatal Errors:** Validation errors or permanent API failures (e.g. 400 Bad Request) throw `HttpsError` or non-retriable errors to stop the workflow and update Firestore status to `failed`.
*   **Stitching Timeouts:** The polling loop has a hard limit (5 mins). If exceeded, it throws a timeout error, marking the job as failed.

## Future Improvements
*   **Dynamic Rate Limiting:** Integrate with a `UserTier` service to enforce dynamic limits based on subscription.
*   **True Daisychaining:** Implement server-side frame extraction to pass the last frame of segment N as the start frame of segment N+1 for perfect continuity (currently relies on independent segments or client-provided images).
