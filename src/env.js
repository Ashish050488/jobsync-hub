import dotenv from "dotenv";
dotenv.config();

export const GROQ_API_KEY = process.env.GEMINI_API_KEY; // Get this from aistudio.google.com
export const MONGO_URI = process.env.MONGO_URI;

export const EMAIL_CONFIG = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'ashar050488@gmail.com',
        pass: process.env.pass 
    },
    to: 'ashishar050488@gmail.com',
    from: '"Job Scraper Bot" <ashar050488@gmail.com>'
};