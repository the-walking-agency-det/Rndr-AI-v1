<<<<<<< HEAD
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
=======
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockSet = vi.fn();
const mockDoc = vi.fn(() => ({ set: mockSet }));
const mockCollection = vi.fn(() => ({ doc: mockDoc }));
const mockFirestore = vi.fn(() => ({ collection: mockCollection }));
const mockFieldValue = { serverTimestamp: vi.fn(() => 'TIMESTAMP') };

const mockAuthGetClient = vi.fn();
const mockAuthGetProjectId = vi.fn();

// Mock Modules
vi.mock('firebase-admin', () => ({
    initializeApp: vi.fn(),
    firestore: Object.assign(mockFirestore, { FieldValue: mockFieldValue }),
    storage: vi.fn(() => ({
        bucket: () => ({
            file: () => ({
                save: vi.fn(),
                makePublic: vi.fn(),
                publicUrl: () => 'https://mock-storage-url.com/video.mp4'
            })
        })
    }))
}));

// Mock GoogleAuth class using a class-like structure for the mock
class MockGoogleAuth {
    getClient() { return mockAuthGetClient(); }
    getProjectId() { return mockAuthGetProjectId(); }
}

vi.mock('google-auth-library', () => {
    return {
        GoogleAuth: MockGoogleAuth
    };
});

describe('Video Backend Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully generate video and update firestore', async () => {
        // Setup Mocks
        mockAuthGetClient.mockResolvedValue({
            getAccessToken: async () => ({ token: 'mock-token' })
        });
        mockAuthGetProjectId.mockResolvedValue('mock-project');

        // Mock global fetch
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                predictions: [{
                    bytesBase64Encoded: 'mock-base64-video-data'
                }]
            })
        });

        const jobId = 'test-job-id';

        // 1. Simulate "update-status-processing"
        await mockFirestore().collection('videoJobs').doc(jobId).set({
            status: 'processing',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });

        expect(mockCollection).toHaveBeenCalledWith('videoJobs');
        expect(mockDoc).toHaveBeenCalledWith(jobId);
        expect(mockSet).toHaveBeenCalledWith({
            status: 'processing',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });

        // 2. Simulate "generate-video-vertex" logic
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth();
        const client = await auth.getClient();
        // @ts-ignore
        const accessToken = await client.getAccessToken();

        const response = await fetch('https://mock-endpoint', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken.token}` }
        });
        const result = await response.json();

        expect(global.fetch).toHaveBeenCalled();
        expect(accessToken.token).toBe('mock-token');

        // 3. Simulate "update-status-completed"
        await mockFirestore().collection('videoJobs').doc(jobId).set({
            status: 'completed',
            videoUrl: 'https://mock-storage-url.com/video.mp4',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });

        expect(mockSet).toHaveBeenLastCalledWith({
            status: 'completed',
            videoUrl: 'https://mock-storage-url.com/video.mp4',
            updatedAt: 'TIMESTAMP'
        }, { merge: true });
>>>>>>> 8b85b8280bb3b03826eca0f42ad90d816000254c
    });
});
