import { AgentConfig } from "../types";
import systemPrompt from '@agents/marketing/prompt.md?raw';

export const MarketingAgent: AgentConfig = {
    id: 'marketing',
    name: 'Marketing Department',
    description: 'Orchestrates multi-channel marketing campaigns, strategy, and content calendars.',
    color: 'bg-orange-500',
    category: 'manager',
    systemPrompt,
    tools: [{
        functionDeclarations: [
            {
                name: 'create_campaign_brief',
                description: 'Generate a marketing campaign brief.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        product: { type: 'STRING', description: 'Product name.' },
                        goal: { type: 'STRING', description: 'Campaign goal.' },
                        audience: { type: 'STRING', description: 'Target audience.' }
                    },
                    required: ['product', 'goal', 'audience']
                }
            },
            {
                name: 'analyze_audience',
                description: 'Analyze a target audience niche.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        niche: { type: 'STRING', description: 'The market niche to analyze.' }
                    },
                    required: ['niche']
                }
            },
            {
                name: 'schedule_content',
                description: 'Schedule content posts for a campaign.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        posts: { type: 'ARRAY', description: 'List of post content.', items: { type: 'STRING' } },
                        start_date: { type: 'STRING', description: 'Start date (YYYY-MM-DD).' }
                    },
                    required: ['posts', 'start_date']
                }
            },
            {
                name: 'track_performance',
                description: 'Get performance metrics for a campaign.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        campaign_id: { type: 'STRING', description: 'ID of the campaign.' }
                    },
                    required: ['campaign_id']
                }
            }
        ]
    }]
};
