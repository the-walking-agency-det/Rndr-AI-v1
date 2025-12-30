import { AI } from '../../ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
<<<<<<< HEAD
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
=======

export const RoadTools = {
    plan_tour_route: async (args: { start_location: string, end_location: string, stops: string[], timeframe: string }) => {
        const prompt = `
        You are a Tour Manager. Plan a logistical route for a tour.

        Start: ${args.start_location}
        End: ${args.end_location}
        Stops/Cities: ${args.stops.join(', ')}
        Timeframe: ${args.timeframe}

        Optimize for logical travel flow.
        Output:
        1. Route Map (Ordered List of Cities)
        2. Distance/Drive Times between stops
        3. Recommended rest days
        `;
        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to plan tour route.";
        } catch (e) {
            return "Error planning tour route.";
        }
    },

    calculate_tour_budget: async (args: { crew_size: number, duration_days: number, accommodation_level: string }) => {
        const prompt = `
        You are a Tour Accountant. Estimate a tour budget.

        Crew Size: ${args.crew_size}
        Duration: ${args.duration_days} days
        Accommodation Level: ${args.accommodation_level} (e.g., Budget, Standard, Luxury)

        Estimate costs for:
        1. Transportation (Gas/Rentals)
        2. Accommodation
        3. Per Diems (Food)
        4. Production Costs
        5. Contingency (10%)
        `;
        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to calculate tour budget.";
        } catch (e) {
            return "Error calculating tour budget.";
        }
    },

    generate_itinerary: async (args: { city: string, date: string, venue: string, show_time: string }) => {
        const prompt = `
        You are a Road Manager. Create a Day Sheet (Itinerary).

        City: ${args.city}
        Date: ${args.date}
        Venue: ${args.venue}
        Show Time: ${args.show_time}

        Include standard slots for:
        - Load In
        - Soundcheck
        - Dinner
        - Doors Open
        - Set Time
        - Load Out
        - Hotel Check-in
        `;
        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to generate itinerary.";
        } catch (e) {
            return "Error generating itinerary.";
        }
    }
>>>>>>> 83f00b38b795d41f22988c84c5574286ee7133cc
};
