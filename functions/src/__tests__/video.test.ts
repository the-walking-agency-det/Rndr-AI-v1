import * as admin from 'firebase-admin';
import * as firebaseFunctionsTest from 'firebase-functions-test';
import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';

// Initialize test sdk
// @ts-expect-error - firebase-functions-test generic export issue
const test = firebaseFunctionsTest.default ? firebaseFunctionsTest.default() : firebaseFunctionsTest();

// Mock Inngest
vi.mock('inngest', () => {
    return {
        Inngest: class {
            constructor() {}
            send = vi.fn().mockResolvedValue({ ids: ['test-event-id'] });
            createFunction = vi.fn((id, trigger, handler) => handler); // Return the handler to test logic directly if needed, or mock completely
        },
        serve: vi.fn(() => (req: any, res: any) => res.send('ok'))
    };
});

// Mock Google Cloud Vertex AI
vi.mock('@google-cloud/vertexai', () => {
    return {
        VertexAI: class {
            constructor(config: any) {}
        },
        PredictionService: class {
            constructor(config: any) {}
            predict = vi.fn().mockResolvedValue([{
                predictions: [{
                    structValue: {
                        fields: {
                            videoUri: { stringValue: 'gs://mock-bucket/video.mp4' }
                        }
                    }
                }]
            }])
        }
    };
});

// Mock Firebase Admin
vi.mock('firebase-admin', async (importOriginal) => {
    const actual = await importOriginal();
    const firestoreMock = {
        collection: vi.fn(() => ({
            doc: vi.fn(() => ({
                set: vi.fn(),
                update: vi.fn(),
                get: vi.fn()
            }))
        }))
    };
    const firestoreFn = vi.fn(() => firestoreMock);
    // @ts-expect-error - Attach static methods to the mock function
    firestoreFn.FieldValue = {
        serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP')
    };

    return {
        // @ts-expect-error - mocking partial implementation
        ...actual,
        initializeApp: vi.fn(),
        firestore: firestoreFn
    };
});

// Import the function to test
// We need to use require or dynamic import because the file initializes admin on load
describe('Video Generation Functions', () => {
    let myFunctions: any;

    beforeAll(async () => {
        // Set environment variables for the test
        process.env.INNGEST_EVENT_KEY = 'mock-key';
        process.env.INNGEST_SIGNING_KEY = 'mock-signing-key';
        process.env.GEMINI_API_KEY = 'mock-gemini-key';
        process.env.VERTEX_PROJECT_ID = 'mock-project';
        process.env.VERTEX_LOCATION = 'us-central1';

        myFunctions = await import('../index');
    });

    afterAll(() => {
        test.cleanup();
    });

    it('triggerVideoJob should queue a job in Inngest and Firestore', async () => {
        const wrapped = test.wrap(myFunctions.triggerVideoJob);

        const data = {
            prompt: "A cinematic shot of a futuristic city",
            jobId: "test-job-123",
            orgId: "test-org",
            aspectRatio: "16:9"
        };

        const context = {
            auth: {
                uid: 'user-123',
                token: {}
            }
        };

        const result = await wrapped(data, context);

        expect(result.success).toBe(true);
        expect(result.message).toContain('queued');

        // Verify Firestore was called
        const firestore = admin.firestore();
        expect(firestore.collection).toHaveBeenCalledWith('videoJobs');
        // Note: checking deep mock calls on chained methods is verbose,
        // essentially we verified the function didn't crash and returned success.
    });

    it('triggerVideoJob should fail without authentication', async () => {
        const wrapped = test.wrap(myFunctions.triggerVideoJob);
        const data = { prompt: "test", jobId: "1" };

        await expect(wrapped(data, {})).rejects.toThrow('User must be authenticated to trigger video generation.');
    });
});
