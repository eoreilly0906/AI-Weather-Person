import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import type { Request, Response } from 'express';
import { OpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { StructuredOutputParser } from 'langchain/output_parsers';

dotenv.config();

const port = process.env.PORT || 3001;
const apiKey = process.env.OPENAI_API_KEY;
const openweathermapApiKey = process.env.OPENWEATHER_API_KEY;


// Check if the API key is defined
if (!apiKey || !openweathermapApiKey) {
  console.error('Missing API keys. Exiting...');
  process.exit(1);
}

const app = express();
app.use(express.json());

//Initialize the OpenAI model
const openai = new OpenAI({ 
  apiKey: apiKey,
});

// Define the parser for the structured output
const parser = StructuredOutputParser.fromZodSchema(z.object({
  location: z.string(),
  forecast: z.string(),
}));

//  Get the format instructions from the parser
const formatInstructions = parser.getFormatInstructions();

//  Define the prompt template
const promptTemplate = new PromptTemplate({
  template: 'You are Shaggy from Scooby-Doo, reading the 5-day weather forecast for {location}. Give the forecast in your usual laid-back and fun style.\n\n{format_instructions}',
  inputVariables: ['location', 'weather_data'],
  partialVariables: { format_instructions: formatInstructions },
});

// Function to fetch weather data from OpenWeather API
// Function to fetch 5-day weather data from OpenWeather API
const getWeatherData = async (location: string) => {
  try {
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/forecast`, {
      params: {
        q: location,
        appid: openweathermapApiKey,
        units: 'metric', 
      },
    });

    const { list } = response.data;

    // Process data to get daily forecasts
    const dailyForecasts: Record<string, { temp: number[]; descriptions: string[] }> = {};

    list.forEach((entry: any) => {
      const date = entry.dt_txt.split(" ")[0]; // Extract date (YYYY-MM-DD)
      if (!dailyForecasts[date]) {
        dailyForecasts[date] = { temp: [], descriptions: [] };
      }
      dailyForecasts[date].temp.push(entry.main.temp);
      dailyForecasts[date].descriptions.push(entry.weather[0].description);
    });

    // Format the forecast output
    const formattedForecast = Object.entries(dailyForecasts)
      .map(([date, data]) => {
        const avgTemp = (data.temp.reduce((sum, t) => sum + t, 0) / data.temp.length).toFixed(1);
        const commonDescription = data.descriptions.sort(
          (a, b) => data.descriptions.filter(v => v === a).length - data.descriptions.filter(v => v === b).length
        ).pop(); // Most common description

        return `${date}: Avg Temp: ${avgTemp}°C, Condition: ${commonDescription}`;
      })
      .join("\n");

    return formattedForecast;
  } catch (error) {
    console.error('Error fetching weather:', error);
    throw new Error('Could not fetch weather data.');
  }
};

// Function to process input and get OpenAI response
const promptFunc = async (location: string) => {
  try {
    const weatherData = await getWeatherData(location);
    const formattedPrompt = await promptTemplate.format({ location, weather_data: weatherData });

    const result = await openai.invoke(formattedPrompt);
    return await parser.parse(result);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
    }
    throw error;
  }
};

// API Endpoint
app.post('/forecast', async (req: Request, res: Response) => {
  try {
    const location: string = req.body.location;
    if (!location) {
      res.status(400).json({ error: 'Please provide a location in the request body.' });
      return;
    }

    const result = await promptFunc(location);
    res.json({ result });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
