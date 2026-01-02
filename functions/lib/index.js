"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ragProxy = exports.generateContentStream = exports.editImage = exports.generateImageV3 = exports.inngestApi = exports.triggerLongFormVideoJob = exports.triggerVideoJob = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const inngest_1 = require("inngest");
const params_1 = require("firebase-functions/params");
const express_1 = require("inngest/express");
const cors_1 = __importDefault(require("cors"));
const video_1 = require("./lib/video");
const video_transcoder_1 = require("@google-cloud/video-transcoder");
const google_auth_library_1 = require("google-auth-library");
// Initialize Firebase Admin
admin.initializeApp();
// Define Secrets
const inngestEventKey = (0, params_1.defineSecret)("INNGEST_EVENT_KEY");
const inngestSigningKey = (0, params_1.defineSecret)("INNGEST_SIGNING_KEY");
const geminiApiKey = (0, params_1.defineSecret)("GEMINI_API_KEY");
// Lazy Initialize Inngest Client
const getInngestClient = () => {
    return new inngest_1.Inngest({
        id: "indii-os-functions",
        eventKey: inngestEventKey.value()
    });
};
const corsHandler = (0, cors_1.default)({ origin: true });
// ----------------------------------------------------------------------------
// Video Generation (Veo)
// ----------------------------------------------------------------------------
/**
 * Trigger Video Generation Job
 *
 * This callable function acts as the bridge between the Client App (Electron)
 * and the Asynchronous Worker Queue (Inngest).
 *
 * Security: protected by Firebase Auth (onCall).
 */
exports.triggerVideoJob = functions
    .runWith({
    secrets: [inngestEventKey],
    timeoutSeconds: 60,
    memory: "256MB"
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated to trigger video generation.");
    }
    const userId = context.auth.uid;
    // Construct input matching the schema
    // The client might pass { jobId, prompt, ... }
    // We ensure defaults are respected via Zod.
    const inputData = Object.assign(Object.assign({}, data), { userId });
    // Zod Validation
    const validation = video_1.VideoJobSchema.safeParse(inputData);
    if (!validation.success) {
        throw new functions.https.HttpsError("invalid-argument", `Validation failed: ${validation.error.issues.map(i => i.message).join(", ")}`);
    }
    const jobData = validation.data;
    try {
        // 1. Create Initial Job Record in Firestore
        // We do this BEFORE sending the event to prevent race conditions where
        // the UI subscribes to a doc that doesn't exist yet.
        await admin.firestore().collection("videoJobs").doc(jobData.jobId).set({
            id: jobData.jobId,
            userId: jobData.userId,
            orgId: jobData.orgId,
            prompt: jobData.prompt,
            status: "queued",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // 2. Publish Event to Inngest
        const inngest = getInngestClient();
        await inngest.send({
            name: "video/generate.requested",
            data: jobData,
            user: {
                id: jobData.userId,
            }
        });
        console.log(`[VideoJob] Triggered for JobID: ${jobData.jobId}, User: ${jobData.userId}`);
        return { success: true, message: "Video generation job queued." };
    }
    catch (error) {
        console.error("[VideoJob] Error triggering Inngest:", error);
        throw new functions.https.HttpsError("internal", `Failed to queue video job: ${error.message}`);
    }
});
/**
 * Trigger Long Form Video Generation Job
 *
 * Handles multi-segment video generation (daisychaining) as a background process.
 */
exports.triggerLongFormVideoJob = functions
    .runWith({
    secrets: [inngestEventKey],
    timeoutSeconds: 60,
    memory: "256MB"
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated for long form generation.");
    }
    const userId = context.auth.uid;
    const { prompts, jobId, orgId, totalDuration, startImage } = data, options = __rest(data, ["prompts", "jobId", "orgId", "totalDuration", "startImage"]);
    if (!prompts || !Array.isArray(prompts) || prompts.length === 0 || !jobId) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required fields: prompts (non-empty array) or jobId.");
    }
    // TODO: Add rate limiting check against user tier
    // Example: const userTier = await getUserTier(userId);
    // if (prompts.length > userTier.maxSegments) throw ...
    try {
        // 1. Create Parent Job Record
        await admin.firestore().collection("videoJobs").doc(jobId).set({
            id: jobId,
            userId: userId,
            orgId: orgId || "personal",
            prompt: prompts[0], // Main prompt
            status: "queued",
            isLongForm: true,
            totalSegments: prompts.length,
            completedSegments: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // 2. Publish Event to Inngest for Long Form
        const inngest = getInngestClient();
        await inngest.send({
            name: "video/long_form.requested",
            data: {
                jobId: jobId,
                userId: userId,
                orgId: orgId || "personal",
                prompts: prompts,
                totalDuration: totalDuration,
                startImage: startImage,
                options: options,
                timestamp: Date.now(),
            },
            user: { id: userId }
        });
        return { success: true, message: "Long form video generation started." };
    }
    catch (error) {
        console.error("[LongFormVideoJob] Error:", error);
        throw new functions.https.HttpsError("internal", `Failed to queue long form job: ${error.message}`);
    }
});
/**
 * Inngest API Endpoint
 *
 * This is the entry point for Inngest Cloud to call back into our functions
 * to execute steps.
 */
exports.inngestApi = functions
    .runWith({
    secrets: [inngestSigningKey, inngestEventKey],
    timeoutSeconds: 540 // 9 minutes, Veo generation can be slow
})
    .https.onRequest((req, res) => {
    const inngestClient = getInngestClient();
    // Actual Video Generation Logic using Veo
    const generateVideoFn = inngestClient.createFunction({ id: "generate-video-logic" }, { event: "video/generate.requested" }, video_1.generateVideoLogic);
    // Long Form Video Generation Logic
    const generateLongFormVideoFn = inngestClient.createFunction({ id: "generate-long-form-video" }, { event: "video/long_form.requested" }, async ({ event, step }) => {
        const { jobId, prompts, userId, orgId, startImage, options } = event.data;
        const segmentUrls = [];
        // Use let to allow updates for daisychaining
        // eslint-disable-next-line prefer-const
        let currentStartImage = startImage;
        try {
            // Update main job status
            await step.run("update-parent-processing", async () => {
                await admin.firestore().collection("videoJobs").doc(jobId).set({
                    status: "processing",
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
            for (let i = 0; i < prompts.length; i++) {
                const segmentId = `${jobId}_seg_${i}`;
                const prompt = prompts[i];
                const segmentUrl = await step.run(`generate-segment-${i}`, async () => {
                    const auth = new google_auth_library_1.GoogleAuth({
                        scopes: ['https://www.googleapis.com/auth/cloud-platform']
                    });
                    const client = await auth.getClient();
                    const projectId = await auth.getProjectId();
                    const accessToken = await client.getAccessToken();
                    const region = 'us-central1';
                    const modelId = 'veo-3.1-generate-preview';
                    const endpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${modelId}:predict`;
                    // Safely construct image payload
                    const imagePayload = currentStartImage ? {
                        image: {
                            bytesBase64Encoded: currentStartImage.includes(',')
                                ? currentStartImage.split(',')[1]
                                : currentStartImage
                        }
                    } : {};
                    const requestBody = {
                        instances: [
                            Object.assign({ prompt: prompt }, imagePayload)
                        ],
                        parameters: {
                            sampleCount: 1,
                            videoLength: "5s",
                            aspectRatio: (options === null || options === void 0 ? void 0 : options.aspectRatio) || "16:9"
                        }
                    };
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken.token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestBody)
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Veo Segment ${i} failed: ${response.status} ${errorText}`);
                    }
                    const result = await response.json();
                    if (!result.predictions || result.predictions.length === 0) {
                        throw new Error(`Veo Segment ${i}: No predictions returned`);
                    }
                    const prediction = result.predictions[0];
                    // Save to Storage
                    const bucket = admin.storage().bucket();
                    const file = bucket.file(`videos/${userId}/${segmentId}.mp4`);
                    if (prediction.bytesBase64Encoded) {
                        await file.save(Buffer.from(prediction.bytesBase64Encoded, 'base64'), {
                            metadata: { contentType: 'video/mp4' }
                        });
                        return `gs://${bucket.name}/videos/${userId}/${segmentId}.mp4`;
                    }
                    if (prediction.videoUri)
                        return prediction.videoUri;
                    if (prediction.gcsUri)
                        return prediction.gcsUri;
                    throw new Error(`Unknown Veo response format for segment ${i}: ` + JSON.stringify(prediction));
                });
                segmentUrls.push(segmentUrl);
                await step.run(`update-progress-${i}`, async () => {
                    await admin.firestore().collection("videoJobs").doc(jobId).set({
                        completedSegments: i + 1,
                        progress: Math.floor(((i + 1) / prompts.length) * 100),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                });
                // Daisy-chaining Logic
                // TODO: Extract last frame from segmentUrl to use as startImage for next segment
                // This requires a frame extraction service (e.g., FFmpeg Cloud Function)
                // Without this, segments won't have visual continuity
                console.warn(`[LongForm] Daisychaining not implemented - segment ${i} generated independently`);
                // NOTE: If we could extract the frame, we would update currentStartImage here.
                // For now, suppress the lint warning that it's never reassigned (via eslint-disable-next-line above)
                // This allows future implementation to just assign currentStartImage = ...
                // Placeholder for future logic
                // currentStartImage = "placeholder_for_next_frame";
            }
            // All segments generated, request stitching
            await step.sendEvent("trigger-stitch", {
                name: "video/stitch.requested",
                data: {
                    jobId,
                    userId,
                    orgId, // Pass orgId to stitching if needed, though not strictly required
                    segmentUrls
                }
            });
        }
        catch (error) {
            console.error("[LongForm] Generation Failed:", error);
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "failed",
                error: error.message,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            throw error;
        }
    });
    // Stitching Function
    const stitchVideoFn = inngestClient.createFunction({ id: "stitch-video-segments" }, { event: "video/stitch.requested" }, async ({ event, step }) => {
        const { jobId, userId, segmentUrls } = event.data;
        const transcoder = new video_transcoder_1.TranscoderServiceClient();
        try {
            const projectId = await admin.app().options.projectId || process.env.GCLOUD_PROJECT;
            if (!projectId) {
                throw new Error("Project ID not configured");
            }
            const region = 'us-central1';
            const bucket = admin.storage().bucket();
            const outputUri = `gs://${bucket.name}/videos/${userId}/${jobId}_final.mp4`;
            const { jobName } = await step.run("create-transcoder-job", async () => {
                const [job] = await transcoder.createJob({
                    parent: transcoder.locationPath(projectId, region),
                    job: {
                        outputUri,
                        config: {
                            inputs: segmentUrls.map((url, index) => {
                                let uri = url;
                                if (uri.startsWith('https://storage.googleapis.com/')) {
                                    uri = uri.replace('https://storage.googleapis.com/', 'gs://').replace(/\?.+$/, '');
                                }
                                else if (!uri.startsWith('gs://')) {
                                    throw new Error(`Invalid storage URL format: ${url}`);
                                }
                                return { key: `input${index}`, uri };
                            }),
                            editList: [
                                {
                                    key: "atom0",
                                    inputs: segmentUrls.map((_, index) => `input${index}`)
                                }
                            ],
                            elementaryStreams: [
                                {
                                    key: "video_stream0",
                                    videoStream: {
                                        h264: {
                                            heightPixels: 720,
                                            widthPixels: 1280,
                                            bitrateBps: 5000000,
                                            frameRate: 30,
                                        },
                                    },
                                }
                            ],
                            muxStreams: [
                                {
                                    key: "final_output",
                                    container: "mp4",
                                    elementaryStreams: ["video_stream0"],
                                }
                            ]
                        }
                    }
                });
                await admin.firestore().collection("videoJobs").doc(jobId).set({
                    status: "stitching",
                    transcoderJobName: job.name,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                return { jobName: job.name };
            });
            // Polling Loop with dynamic step IDs to avoid Inngest memoization loop
            let jobStatus = "PENDING";
            let attempt = 0;
            while (jobStatus === "PENDING" || jobStatus === "RUNNING") {
                attempt++;
                await step.sleep(`poll-wait-${attempt}`, "5s");
                const statusResult = await step.run(`check-job-status-${attempt}`, async () => {
                    const [job] = await transcoder.getJob({ name: jobName });
                    return job.state;
                });
                // Transcoder State: JOB_STATE_UNSPECIFIED, PENDING, RUNNING, SUCCEEDED, FAILED
                // We convert/check manually.
                if (statusResult === "SUCCEEDED") {
                    jobStatus = "SUCCEEDED";
                }
                else if (statusResult === "FAILED") {
                    jobStatus = "FAILED";
                }
                else {
                    jobStatus = "PENDING"; // Continue loop
                }
            }
            if (jobStatus === "SUCCEEDED") {
                // Get Signed URL for Output
                const signedUrl = await step.run("get-signed-url", async () => {
                    const file = bucket.file(`videos/${userId}/${jobId}_final.mp4`);
                    const [url] = await file.getSignedUrl({
                        action: 'read',
                        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
                    });
                    return url;
                });
                await step.run("mark-completed", async () => {
                    await admin.firestore().collection("videoJobs").doc(jobId).set({
                        status: "completed",
                        videoUrl: signedUrl,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                });
            }
            else {
                throw new Error("Transcoder job failed");
            }
        }
        catch (error) {
            console.error("Stitching failed:", error);
            await admin.firestore().collection("videoJobs").doc(jobId).set({
                status: "failed",
                stitchError: error.message,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        finally {
            await transcoder.close();
        }
    });
    const handler = (0, express_1.serve)({
        client: inngestClient,
        functions: [generateVideoFn, generateLongFormVideoFn, stitchVideoFn],
        signingKey: inngestSigningKey.value(),
    });
    return handler(req, res);
});
exports.generateImageV3 = functions
    .runWith({ secrets: [geminiApiKey] })
    .https.onCall(async (data, context) => {
    try {
        const { prompt, aspectRatio, count, images } = data;
        const modelId = "gemini-3-pro-image-preview";
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiApiKey.value()}`;
        const parts = [{ text: prompt }];
        if (images) {
            images.forEach(img => {
                parts.push({
                    inlineData: {
                        mimeType: img.mimeType || "image/png",
                        data: img.data
                    }
                });
            });
        }
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: parts }],
                generationConfig: Object.assign({ responseModalities: ["TEXT", "IMAGE"], candidateCount: count || 1 }, (aspectRatio ? { imageConfig: { aspectRatio } } : {}))
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new functions.https.HttpsError('internal', errorText);
        }
        const result = await response.json();
        const candidates = result.candidates || [];
        const processedImages = candidates.flatMap((c) => {
            var _a;
            return (((_a = c.content) === null || _a === void 0 ? void 0 : _a.parts) || [])
                .filter((p) => p.inlineData)
                .map((p) => ({
                bytesBase64Encoded: p.inlineData.data,
                mimeType: p.inlineData.mimeType
            }));
        });
        return { images: processedImages };
    }
    catch (error) {
        console.error("Function Error:", error);
        throw new functions.https.HttpsError('internal', error.message || "Unknown error");
    }
});
exports.editImage = functions
    .runWith({ secrets: [geminiApiKey] })
    .https.onCall(async (data, context) => {
    try {
        const { image, mask, prompt, referenceImage } = data;
        const modelId = "gemini-3-pro-image-preview";
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiApiKey.value()}`;
        const parts = [
            {
                inlineData: {
                    mimeType: "image/png",
                    data: image
                }
            }
        ];
        if (mask) {
            parts.push({
                inlineData: {
                    mimeType: "image/png",
                    data: mask
                }
            });
            parts.push({ text: "Use the second image as a mask for inpainting." });
        }
        if (referenceImage) {
            parts.push({
                inlineData: {
                    mimeType: "image/png",
                    data: referenceImage
                }
            });
            parts.push({ text: "Use this third image as a reference." });
        }
        parts.push({ text: prompt });
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{
                        role: "user",
                        parts: parts
                    }],
                generation_config: {
                    response_modalities: ["IMAGE"],
                }
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new functions.https.HttpsError('internal', errorText);
        }
        const result = await response.json();
        return result;
    }
    catch (error) {
        console.error("Function Error:", error);
        if (error instanceof Error) {
            throw new functions.https.HttpsError('internal', error.message);
        }
        throw new functions.https.HttpsError('internal', "An unknown error occurred");
    }
});
exports.generateContentStream = functions
    .runWith({
    secrets: [geminiApiKey],
    timeoutSeconds: 300
})
    .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        var _a, _b, _c, _d, _e, _f;
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }
        // Verify Authentication
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).send('Unauthorized');
            return;
        }
        const idToken = authHeader.split('Bearer ')[1];
        try {
            await admin.auth().verifyIdToken(idToken);
        }
        catch (error) {
            res.status(403).send('Forbidden: Invalid Token');
            return;
        }
        try {
            const { model, contents, config } = req.body;
            const modelId = model || "gemini-3-pro-preview";
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${geminiApiKey.value()}`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: config
                })
            });
            if (!response.ok) {
                const error = await response.text();
                res.status(response.status).send(error);
                return;
            }
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            const reader = (_a = response.body) === null || _a === void 0 ? void 0 : _a.getReader();
            if (!reader) {
                res.status(500).send('No response body');
                return;
            }
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            const text = (_f = (_e = (_d = (_c = (_b = data.candidates) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.parts) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.text;
                            if (text) {
                                res.write(JSON.stringify({ text }) + '\n');
                            }
                        }
                        catch (_g) {
                            // Ignore parse errors for partial chunks
                        }
                    }
                }
            }
            res.end();
        }
        catch (error) {
            console.error("[generateContentStream] Error:", error);
            if (!res.headersSent) {
                res.status(500).send(error.message);
            }
            else {
                res.end();
            }
        }
    });
});
exports.ragProxy = functions
    .runWith({
    secrets: [geminiApiKey],
    timeoutSeconds: 60
})
    .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        // Verify Authentication
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).send('Unauthorized');
            return;
        }
        const idToken = authHeader.split('Bearer ')[1];
        try {
            await admin.auth().verifyIdToken(idToken);
        }
        catch (error) {
            res.status(403).send('Forbidden: Invalid Token');
            return;
        }
        try {
            const targetPath = req.path;
            // SECURITY: Restrict proxy to allowed RAG paths to prevent abuse of the API key
            // Allows:
            // - /v1beta/files... (Upload/Get/Delete)
            // - /upload/v1beta/files... (Upload Media)
            // - /v1beta/fileSearchStores... (Create/Get Stores)
            // - /v1beta/models... (Generate Content, etc)
            // - /v1beta/operations... (Poll Operations)
            const allowedPrefixes = [
                '/v1beta/files',
                '/upload/v1beta/files',
                '/v1beta/fileSearchStores',
                '/v1beta/models',
                '/v1beta/operations'
            ];
            if (!allowedPrefixes.some(prefix => targetPath.startsWith(prefix))) {
                console.warn(`[ragProxy] Blocked unauthorized path: ${targetPath}`);
                res.status(403).send({ error: 'Forbidden: Path not allowed via ragProxy.' });
                return;
            }
            const baseUrl = 'https://generativelanguage.googleapis.com';
            const targetUrl = `${baseUrl}${targetPath}?key=${geminiApiKey.value()}`;
            const fetchOptions = {
                method: req.method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: (req.method !== 'GET' && req.method !== 'HEAD') ?
                    (typeof req.body === 'object' ? JSON.stringify(req.body) : req.body)
                    : undefined
            };
            const response = await fetch(targetUrl, fetchOptions);
            const data = await response.text();
            res.status(response.status);
            try {
                res.send(JSON.parse(data));
            }
            catch (_a) {
                res.send(data);
            }
        }
        catch (error) {
            res.status(500).send({ error: error.message });
        }
    });
});
//# sourceMappingURL=index.js.map