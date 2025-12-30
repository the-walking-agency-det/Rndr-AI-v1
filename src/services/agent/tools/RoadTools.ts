import { AI } from '../../ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { MapsTools } from './MapsTools';

export const RoadTools = {
    plan_tour_route: async (args: { cities: string[] }) => {
        // Reuse MapsTools distance matrix if possible, or just generate a route order via AI
        const prompt = `
        Optimize a tour route for these cities: ${args.cities.join(', ')}.
        Return an ordered list minimizing travel distance.
        `;
        const res = await AI.generateContent({
            model: AI_MODELS.TEXT.AGENT,
            contents: { role: 'user', parts: [{ text: prompt }] }
        });
        return res.text() || "Route planning failed.";
    },

    calculate_tour_budget: async (args: { days: number, crew_size: number }) => {
        // Simple logic or AI estimation
        const perDiem = 50;
        const hotel = 150;
        const total = (perDiem + hotel) * args.days * args.crew_size;
        return JSON.stringify({
            estimated_budget: total,
            currency: 'USD',
            breakdown: { per_diem: perDiem, hotel: hotel, crew: args.crew_size }
        });
    },

    book_logistics: async (args: { location: string, type: 'hotel' | 'flight' }) => {
        // Mock booking
        return JSON.stringify({
            status: "booked (mock)",
            location: args.location,
            type: args.type,
            confirmation: "XYZ-" + Math.floor(Math.random() * 1000)
        });
    },

    generate_itinerary: async (args: { start_date: string, cities: string[] }) => {
        const prompt = `
        Generate a detailed tour itinerary starting ${args.start_date}.
        Cities: ${args.cities.join(', ')}.
        Include travel days and show days.
        `;
        const res = await AI.generateContent({
            model: AI_MODELS.TEXT.AGENT,
            contents: { role: 'user', parts: [{ text: prompt }] }
        });
        return res.text() || "Itinerary generation failed.";
    },

    // Re-export specific map tools if the agent needs them directly via this namespace
    search_places: MapsTools.search_places,
    get_distance_matrix: MapsTools.get_distance_matrix
};
