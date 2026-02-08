import { tool } from "ai";
import { z } from "zod";

/**
 * TODO: Implement the weather data tool
 *
 * This tool should:
 * 1. Accept parameters for location, forecast days, and weather variables
 * 2. Use the Open-Meteo API to fetch weather forecast data
 * 3. Return structured weather data that the LLM can use to answer questions
 *
 * Open-Meteo API docs: https://open-meteo.com/en/docs
 * Base URL: https://api.open-meteo.com/v1/forecast
 *
 * Example API call:
 *   https://api.open-meteo.com/v1/forecast?latitude=35.6762&longitude=139.6503&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3
 *
 * Steps to implement:
 *   a. Define the tool parameters schema using Zod:
 *      - latitude (number, required): Latitude of the location
 *      - longitude (number, required): Longitude of the location
 *      - forecast_days (number, optional, default 3): Number of days to forecast (1-7)
 *      - daily (array of strings, optional): Weather variables to include
 *        Useful variables: temperature_2m_max, temperature_2m_min,
 *        precipitation_sum, windspeed_10m_max, weathercode
 *
 *   b. Make a fetch request to the Open-Meteo API with the parameters
 *
 *   c. Parse the JSON response and return it
 *
 *   d. Handle errors:
 *      - API errors (non-200 status)
 *      - Network failures
 *      - Invalid response format
 *
 * Hints:
 *   - The LLM will provide latitude/longitude — you can trust it to geocode city names
 *   - Open-Meteo is free and requires no API key
 *   - Keep the return format simple — the LLM will format it for the user
 */

export const weatherTool = tool({
  description:
    "Get weather forecast data for a location. Use this when the user asks about weather, temperature, rain, wind, or forecasts for any location.",
    // TODO: Define your parameters here
    // Example:
    // latitude: z.number().describe("Latitude of the location"),
    parameters: z.object({
      latitude: z.number().min(-90).max(90).describe("Latitude of the location (-90 to 90)"),
      longitude: z.number().min(-180).max(180).describe("Longitude of the location (-180 to 180)"),
      forecast_days: z.number().min(1).max(16).describe("Number of days to forecast (1-16)").default(3),
      daily: z.array(z.string()).describe("Weather variables to include (temperature_2m_max, temperature_2m_min, precipitation_sum, windspeed_10m_max, weathercode)"),
    }),
    // longitude: z.number().describe("Longitude of the location"),
  execute: async (params) => {
    try {
      const { latitude, longitude, forecast_days = 3, daily } = params;
      const baseUrl = "https://api.open-meteo.com/v1/forecast";
      const queryParams = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        forecast_days: forecast_days.toString(),
        timezone: "auto",
      });
      
      // Add daily weather variables
      if (daily && daily.length > 0) {
        queryParams.append("daily", daily.join(","));
      }
      
      const url = `${baseUrl}?${queryParams.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch weather data: ${response.statusText}`);
      }
      const data = await response.json();
      if (!data.daily || !data.daily.time) {
        throw new Error("Invalid response format from Open-Meteo API");
      }
      return {
        success: true,
        location: {
          latitude: data.latitude,
          longitude: data.longitude,
          timezone: data.timezone,
          elevation: data.elevation,
        },
        daily: {
          time: data.daily.time,
          temperature_max: data.daily.temperature_2m_max,
          temperature_min: data.daily.temperature_2m_min,
          precipitation: data.daily.precipitation_sum,
          windspeed: data.daily.windspeed_10m_max,
          weathercode: data.daily.weathercode,
        },
        units: data.daily_units,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("fetch failed")) {
          return {
            success: false,
            error: "Network error: Unable to reach Open-Meteo API",
            details: error.message,
          };
        }
        
        // API err
        return {
          success: false,
          error: "Failed to fetch weather data",
          details: error.message,
        };
      }
      
      // Unknown error
      return {
        success: false,
        error: "Unknown error occurred",
        details: String(error),
      };
    }
  },
});