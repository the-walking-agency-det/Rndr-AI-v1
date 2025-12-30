
import { AgentConfig } from "../types";
import systemPrompt from '@agents/brand/prompt.md?raw';

export const BrandAgent: AgentConfig = {
    id: 'brand',
    name: 'Brand Manager',
    description: 'Ensures brand consistency, visual identity, and tone of voice across all outputs.',
    color: 'bg-amber-500',
    category: 'manager',
    systemPrompt,
    tools: [{
        functionDeclarations: [
            {
                name: 'verify_output',
                description: 'Critique and verify generated content against a goal (Brand Bible).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        goal: { type: 'STRING', description: 'The original goal or brand guidelines.' },
                        content: { type: 'STRING', description: 'The content to verify.' }
                    },
                    required: ['goal', 'content']
                }
            },
            {
                name: 'analyze_brand_consistency',
                description: 'Analyze content for consistency with brand guidelines.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        content: { type: 'STRING', description: 'The content to analyze.' },
                        brand_guidelines: { type: 'STRING', description: 'Optional explicit guidelines.' }
                    },
                    required: ['content']
                }
            },
            {
                name: 'generate_brand_guidelines',
                description: 'Generate a new Brand Guideline document.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        company_name: { type: 'STRING', description: 'Name of the company.' },
                        values: { type: 'ARRAY', description: 'Core values.', items: { type: 'STRING' } }
                    },
                    required: ['company_name', 'values']
                }
            },
            {
                name: 'audit_visual_assets',
                description: 'Audit a list of visual assets for compliance.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        asset_list: { type: 'ARRAY', description: 'List of asset names/URLs.', items: { type: 'STRING' } }
                    },
                    required: ['asset_list']
                }
            }
        ]
    }]
};
