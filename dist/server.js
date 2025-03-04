import dotenv from 'dotenv';
import express from 'express';
dotenv.config();
const port = process.env.PORT || 3001;
const apiKey = process.env.OPENAI_API_KEY;
// Check if the API key is defined
if (!apiKey) {
    console.error('OPENAI_API_KEY is not defined. Exiting...');
    process.exit(1);
}
const app = express();
app.use(express.json());
// TODO: Initialize the OpenAI model
// TODO: Define the parser for the structured output
// TODO: Get the format instructions from the parser
// TODO: Define the prompt template
// Create a prompt function that takes the user input and passes it through the call method
const promptFunc = async (input) => {
    // TODO: Format the prompt with the user input
    // TODO: Call the model with the formatted prompt
    // TODO: return the JSON response
    // TODO: Catch any errors and log them to the console
};
// Endpoint to handle request
app.post('/forecast', async (req, res) => {
    try {
        const location = req.body.location;
        if (!location) {
            res.status(400).json({
                error: 'Please provide a location in the request body.',
            });
        }
        const result = await promptFunc(location);
        res.json({ result });
    }
    catch (error) {
        if (error instanceof Error) {
            console.error('Error:', error.message);
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
