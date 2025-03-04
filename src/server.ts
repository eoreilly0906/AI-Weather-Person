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

// TODO: Initialize the OpenAI model
const openai = new OpenAI({ 
  apiKey: apiKey,
});

// TODO: Define the parser for the structured output
const parser = StructuredOutputParser.fromZodSchema(z.object({
  location: z.string(),
  forecast: z.string(),
}));

// TODO: Get the format instructions from the parser
const formatInstructions = parser.getFormatInstructions();

// TODO: Define the prompt template
const promptTemplate = new PromptTemplate({
  template: 'You are Shaggy from Scooby-Doo and reading the weather forcast. For the location {location}, provide the weather forecast.\n\n{format_instructions}',
  inputVariables: ['location', 'weather_data'],
  partialVariables: { format_instructions: formatInstructions },
});

// Function to fetch weather data from OpenWeather API
const getWeatherData = async (location: string) => {
  try {
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
      params: {
        q: location,
        appid: openweathermapApiKey,
        units: 'metric', // Use 'imperial' for Fahrenheit
      },
    });

    const { weather, main, wind } = response.data;
    return `Temperature: ${main.temp}°C, Feels Like: ${main.feels_like}°C, Condition: ${weather[0].description}, Humidity: ${main.humidity}%, Wind Speed: ${wind.speed} m/s.`;
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
