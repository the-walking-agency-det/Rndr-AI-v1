import { AgentConfig } from "../types";
import systemPrompt from '@agents/road/prompt.md?raw';

export const RoadAgent: AgentConfig = {
    id: 'road',
    name: 'Road Manager',
    description: 'Manages logistics and tour planning.',
    color: 'bg-yellow-500',
    category: 'manager',
    systemPrompt,
    tools: [{
        functionDeclarations: [
            {
                name: "create_project",
                description: "Create a new tour or event project.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        name: { type: "STRING", description: "Name of the tour/event." },
                        type: { type: "STRING", enum: ["marketing", "creative", "music", "road"], description: "Project type (usually 'road')." }
                    },
                    required: ["name"]
                }
            },
            {
                name: "search_knowledge",
                description: "Research venue details, logistics, or travel info from the knowledge base.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Search query." }
                    },
                    required: ["query"]
                }
            },
            {
                name: "search_places",
                description: "Search for real-world places (venues, hotels, stores) using Google Maps.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Search query (e.g., 'Jazz clubs in Chicago')." },
                        type: { type: "STRING", description: "Optional place type (e.g., 'restaurant')." }
                    },
                    required: ["query"]
                }
            },
            {
                name: "get_place_details",
                description: "Get details (address, phone, rating) for a specific place by ID.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        place_id: { type: "STRING", description: "Google Place ID." }
                    },
                    required: ["place_id"]
                }
            },
            {
                name: "get_distance_matrix",
                description: "Calculate driving distance and time between locations.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        origins: { type: "ARRAY", description: "Starting points (addresses or cities).", items: { type: "STRING" } },
                        destinations: { type: "ARRAY", description: "Destinations (addresses or cities).", items: { type: "STRING" } }
                    },
                    required: ["origins", "destinations"]
                }
            },
            {
                name: "generate_social_post",
                description: "Generate tour updates for social media.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        platform: { type: "STRING", description: "Platform (e.g. Instagram)." },
                        topic: { type: "STRING", description: "Update content." }
                    },
                    required: ["topic"]
                }
            },
            {
                name: "plan_tour_route",
                description: "Optimize the order of cities for a tour.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        cities: { type: "ARRAY", description: "List of cities to visit.", items: { type: "STRING" } }
                    },
                    required: ["cities"]
                }
            },
            {
                name: "calculate_tour_budget",
                description: "Estimate the budget for a tour leg.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        days: { type: "NUMBER", description: "Number of days." },
                        crew_size: { type: "NUMBER", description: "Number of crew members." }
                    },
                    required: ["days", "crew_size"]
                }
            },
            {
                name: "book_logistics",
                description: "Coordinate travel or lodging.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        location: { type: "STRING", description: "City or Venue." },
                        type: { type: "STRING", enum: ["hotel", "flight"], description: "Type of booking." }
                    },
                    required: ["location", "type"]
                }
            },
            {
                name: "generate_itinerary",
                description: "Generate a detailed day-by-day itinerary.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        start_date: { type: "STRING", description: "Start date of the tour." },
                        cities: { type: "ARRAY", description: "List of cities.", items: { type: "STRING" } }
                    },
                    required: ["start_date", "cities"]
                }
            }
        ]
    }]
};
